package db

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// The admin panel's writes: properties, auctions and bidder records.
//
// Under Supabase these were plain inserts and updates from the browser's
// session, and row level security decided whether each landed. The same rule now
// sits in every statement as the tenant predicate the reads use, so a write
// aimed at another institution's row matches nothing and reports ErrNotFound —
// indistinguishable from a row that does not exist, which is the point.

var (
	// ErrConflict is a unique-key collision the caller can fix, such as a slug
	// another property already uses.
	ErrConflict = errors.New("conflict")
)

const maxImages = 40

// PropertyInput is the property form. OrganizationID is honoured only for a
// platform administrator; everyone else writes into their own institution
// whatever the request says.
type PropertyInput struct {
	OrganizationID *uuid.UUID `json:"organization_id"`
	Title          string     `json:"title"`
	Slug           string     `json:"slug"`
	Type           string     `json:"type"`
	Province       string     `json:"province"`
	District       string     `json:"district"`
	Municipality   string     `json:"municipality"`
	Ward           *int       `json:"ward"`
	Address        string     `json:"address"`
	LandAreaAana   *float64   `json:"land_area_aana"`
	LandAreaSqm    *float64   `json:"land_area_sqm"`
	BuildingFloors *int       `json:"building_floors"`
	BuiltYear      *int       `json:"built_year"`
	Bedrooms       *int       `json:"bedrooms"`
	Bathrooms      *int       `json:"bathrooms"`
	RoadAccess     *string    `json:"road_access"`
	Facing         *string    `json:"facing"`
	Description    string     `json:"description"`
	Latitude       *float64   `json:"latitude"`
	Longitude      *float64   `json:"longitude"`
	VideoURL       *string    `json:"video_url"`
	IsPublished    bool       `json:"is_published"`
	ImageURLs      []string   `json:"image_urls"`
}

func (in *PropertyInput) normalise() error {
	in.Title = strings.TrimSpace(in.Title)
	in.Slug = strings.Trim(slugUnsafe.ReplaceAllString(strings.ToLower(strings.TrimSpace(in.Slug)), "-"), "-")
	if in.Slug == "" {
		in.Slug = strings.Trim(slugUnsafe.ReplaceAllString(strings.ToLower(in.Title), "-"), "-")
	}
	if in.Title == "" || in.Slug == "" {
		return ErrValidation
	}
	if len(in.ImageURLs) > maxImages {
		return ErrValidation
	}
	urls := in.ImageURLs[:0]
	for _, u := range in.ImageURLs {
		u = strings.TrimSpace(u)
		if u == "" {
			continue
		}
		// Only absolute https URLs: anything else would be rendered on the
		// public listing as an image from wherever the string pointed.
		parsed, err := url.Parse(u)
		if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
			return ErrValidation
		}
		urls = append(urls, u)
	}
	in.ImageURLs = urls
	return nil
}

// propertyOrg decides which institution a property is written into.
func propertyOrg(s auth.Scope, in PropertyInput) (uuid.UUID, error) {
	if s.IsPlatformAdmin {
		if in.OrganizationID == nil || *in.OrganizationID == uuid.Nil {
			return uuid.Nil, ErrValidation
		}
		return *in.OrganizationID, nil
	}
	return s.OrganizationID, nil
}

// SaveProperty creates a property (id nil) or updates one, replacing its image
// set in the same transaction, and returns its id.
func (d *DB) SaveProperty(ctx context.Context, s auth.Scope, id *uuid.UUID, in PropertyInput) (uuid.UUID, error) {
	if err := in.normalise(); err != nil {
		return uuid.Nil, err
	}
	org, err := propertyOrg(s, in)
	if err != nil {
		return uuid.Nil, err
	}
	tenantOrg, all := s.Tenant()

	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	// The target institution must exist; a platform admin could otherwise
	// name a uuid that matches nothing and get a foreign-key error back.
	var exists bool
	if err := tx.QueryRow(ctx, `select exists (select 1 from organizations where id = $1)`, org).Scan(&exists); err != nil {
		return uuid.Nil, err
	}
	if !exists {
		return uuid.Nil, ErrValidation
	}

	args := []any{
		org, in.Title, in.Slug, in.Type, strings.TrimSpace(in.Province),
		strings.TrimSpace(in.District), strings.TrimSpace(in.Municipality), in.Ward,
		strings.TrimSpace(in.Address), in.LandAreaAana, in.LandAreaSqm,
		in.BuildingFloors, in.BuiltYear, in.Bedrooms, in.Bathrooms,
		trimPtr(in.RoadAccess), trimPtr(in.Facing), strings.TrimSpace(in.Description),
		in.Latitude, in.Longitude, trimPtr(in.VideoURL), in.IsPublished,
	}

	var propertyID uuid.UUID
	if id == nil {
		err = tx.QueryRow(ctx, `
			insert into properties (organization_id, title, slug, type, province, district,
				municipality, ward, address, land_area_aana, land_area_sqm, building_floors,
				built_year, bedrooms, bathrooms, road_access, facing, description,
				latitude, longitude, video_url, is_published)
			values ($1, $2, $3, $4::property_type, $5, $6, $7, $8, $9, $10, $11, $12,
				$13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
			returning id`, args...).Scan(&propertyID)
	} else {
		args = append(args, *id, tenantOrg, all)
		err = tx.QueryRow(ctx, `
			update properties p
			   set organization_id = $1, title = $2, slug = $3, type = $4::property_type,
			       province = $5, district = $6, municipality = $7, ward = $8, address = $9,
			       land_area_aana = $10, land_area_sqm = $11, building_floors = $12,
			       built_year = $13, bedrooms = $14, bathrooms = $15, road_access = $16,
			       facing = $17, description = $18, latitude = $19, longitude = $20,
			       video_url = $21, is_published = $22, updated_at = now()
			 where p.id = $23 and ($25 or p.organization_id = $24)
			returning p.id`, args...).Scan(&propertyID)
	}
	if err := classify(err); err != nil {
		return uuid.Nil, err
	}

	if _, err := tx.Exec(ctx, `delete from property_images where property_id = $1`, propertyID); err != nil {
		return uuid.Nil, err
	}
	for i, u := range in.ImageURLs {
		if _, err := tx.Exec(ctx, `
			insert into property_images (property_id, url, alt, sort_order)
			values ($1, $2, $3, $4)`, propertyID, u, in.Title, i); err != nil {
			return uuid.Nil, err
		}
	}
	return propertyID, tx.Commit(ctx)
}

// DeleteProperty removes a property with its images, auctions and their bidder
// records (all cascade).
func (d *DB) DeleteProperty(ctx context.Context, s auth.Scope, id uuid.UUID) error {
	org, all := s.Tenant()
	tag, err := d.Pool.Exec(ctx,
		`delete from properties p where p.id = $3 and `+tenant, org, all, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// AuctionInput is the auction form.
type AuctionInput struct {
	PropertyID         uuid.UUID `json:"property_id"`
	Round              int       `json:"round"`
	NoticeNumber       string    `json:"notice_number"`
	PublishedDate      *string   `json:"published_date"`
	SubmissionDeadline time.Time `json:"submission_deadline"`
	OpeningDatetime    time.Time `json:"opening_datetime"`
	OpeningVenue       string    `json:"opening_venue"`
	AppraisedValue     *float64  `json:"appraised_value"`
	MinimumBid         float64   `json:"minimum_bid"`
	BidSecurityAmount  float64   `json:"bid_security_amount"`
	BidSecurityPct     *float64  `json:"bid_security_pct"`
	Terms              string    `json:"terms"`
	RequiredDocuments  string    `json:"required_documents"`
	NoticePDFURL       *string   `json:"notice_pdf_url"`
	Status             string    `json:"status"`
	WinningAmount      *float64  `json:"winning_amount"`
	ResultNote         *string   `json:"result_note"`
}

// SaveAuction creates or updates an auction. The property it hangs off must be
// inside the caller's scope — both the one it is moving to and, on update, the
// one it currently belongs to.
func (d *DB) SaveAuction(ctx context.Context, s auth.Scope, id *uuid.UUID, in AuctionInput) (uuid.UUID, error) {
	if in.Round < 1 {
		in.Round = 1
	}
	if in.SubmissionDeadline.IsZero() || in.OpeningDatetime.IsZero() || in.PropertyID == uuid.Nil {
		return uuid.Nil, ErrValidation
	}
	var published *string
	if in.PublishedDate != nil && strings.TrimSpace(*in.PublishedDate) != "" {
		published = in.PublishedDate
	}
	org, all := s.Tenant()

	tx, err := d.Pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var visible bool
	if err := tx.QueryRow(ctx,
		`select exists (select 1 from properties p where p.id = $3 and `+tenant+`)`,
		org, all, in.PropertyID).Scan(&visible); err != nil {
		return uuid.Nil, err
	}
	if !visible {
		return uuid.Nil, ErrNotFound
	}

	args := []any{
		in.PropertyID, in.Round, strings.TrimSpace(in.NoticeNumber), published,
		in.SubmissionDeadline, in.OpeningDatetime, strings.TrimSpace(in.OpeningVenue),
		in.AppraisedValue, in.MinimumBid, in.BidSecurityAmount, in.BidSecurityPct,
		strings.TrimSpace(in.Terms), strings.TrimSpace(in.RequiredDocuments),
		trimPtr(in.NoticePDFURL), in.Status, in.WinningAmount, trimPtr(in.ResultNote),
	}
	var auctionID uuid.UUID
	if id == nil {
		err = tx.QueryRow(ctx, `
			insert into auctions (property_id, round, notice_number, published_date,
				submission_deadline, opening_datetime, opening_venue, appraised_value,
				minimum_bid, bid_security_amount, bid_security_pct, terms,
				required_documents, notice_pdf_url, status, winning_amount, result_note)
			values ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
				$15::auction_status, $16, $17)
			returning id`, args...).Scan(&auctionID)
	} else {
		args = append(args, *id, org, all)
		err = tx.QueryRow(ctx, `
			update auctions a
			   set property_id = $1, round = $2, notice_number = $3, published_date = $4::date,
			       submission_deadline = $5, opening_datetime = $6, opening_venue = $7,
			       appraised_value = $8, minimum_bid = $9, bid_security_amount = $10,
			       bid_security_pct = $11, terms = $12, required_documents = $13,
			       notice_pdf_url = coalesce($14, a.notice_pdf_url), status = $15::auction_status, winning_amount = $16,
			       result_note = $17, updated_at = now()
			  from properties p
			 where a.id = $18 and p.id = a.property_id and ($20 or p.organization_id = $19)
			returning a.id`, args...).Scan(&auctionID)
	}
	if err := classify(err); err != nil {
		return uuid.Nil, err
	}
	return auctionID, tx.Commit(ctx)
}

// SetAuctionStatus is the quick status change from the auctions list.
func (d *DB) SetAuctionStatus(ctx context.Context, s auth.Scope, id uuid.UUID, status string) error {
	org, all := s.Tenant()
	tag, err := d.Pool.Exec(ctx, `
		update auctions a set status = $4::auction_status, updated_at = now()
		  from properties p
		 where a.id = $3 and p.id = a.property_id and `+tenant,
		org, all, id, status)
	if err := classify(err); err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// BidderInput is one bidder record, entered by staff from a paper submission.
type BidderInput struct {
	AuctionID     uuid.UUID `json:"auction_id"`
	FullName      string    `json:"full_name"`
	Phone         string    `json:"phone"`
	Email         string    `json:"email"`
	CitizenshipNo string    `json:"citizenship_no"`
	DepositAmount *float64  `json:"deposit_amount"`
	Notes         string    `json:"notes"`
}

// AddBidder records a bidder against an auction in the caller's scope.
func (d *DB) AddBidder(ctx context.Context, s auth.Scope, in BidderInput) (uuid.UUID, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	if in.FullName == "" || in.AuctionID == uuid.Nil {
		return uuid.Nil, ErrValidation
	}
	org, all := s.Tenant()
	var id uuid.UUID
	err := d.Pool.QueryRow(ctx, `
		insert into bidder_records (auction_id, full_name, phone, email, citizenship_no,
			deposit_amount, notes)
		select a.id, $4, $5, $6, $7, $8, $9
		  from auctions a join properties p on p.id = a.property_id
		 where a.id = $3 and `+tenant+`
		returning id`,
		org, all, in.AuctionID, in.FullName, strings.TrimSpace(in.Phone),
		strings.TrimSpace(in.Email), strings.TrimSpace(in.CitizenshipNo),
		in.DepositAmount, strings.TrimSpace(in.Notes)).Scan(&id)
	return id, classify(err)
}

// SetBidderStatus records the outcome of checking a bidder's deposit.
func (d *DB) SetBidderStatus(ctx context.Context, s auth.Scope, id uuid.UUID, status string) error {
	org, all := s.Tenant()
	tag, err := d.Pool.Exec(ctx, `
		update bidder_records b set deposit_status = $4::deposit_status, updated_at = now()
		  from auctions a join properties p on p.id = a.property_id
		 where b.id = $3 and a.id = b.auction_id and `+tenant,
		org, all, id, status)
	if err := classify(err); err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteBidder removes a bidder record.
func (d *DB) DeleteBidder(ctx context.Context, s auth.Scope, id uuid.UUID) error {
	org, all := s.Tenant()
	tag, err := d.Pool.Exec(ctx, `
		delete from bidder_records b
		 using auctions a join properties p on p.id = a.property_id
		 where b.id = $3 and a.id = b.auction_id and `+tenant,
		org, all, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// classify maps the database errors a form can cause onto the package's
// sentinel errors, so handlers can answer 400/404/409 instead of 500.
func classify(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		switch pg.Code {
		case "23505": // unique_violation
			return ErrConflict
		case "22P02", "23502", "23514", "22007", "22008", "22003": // bad enum/text, not null, check, date/time, numeric range
			return ErrValidation
		}
	}
	return err
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}
