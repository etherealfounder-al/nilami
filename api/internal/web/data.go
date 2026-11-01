package web

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// The shapes the page queries already return.
//
// Unmarshalled rather than re-queried: the documents are assembled in Postgres
// for the API, and building a second set of SQL for these pages would be two
// definitions of one page that drift apart. The cost is a round trip through
// JSON inside one process, which is nothing beside a second query to maintain.

type Org struct {
	Slug         string  `json:"slug"`
	Name         string  `json:"name"`
	NameNP       string  `json:"name_np"`
	LogoURL      *string `json:"logo_url"`
	Website      *string `json:"website"`
	ContactEmail string  `json:"contact_email"`
	ContactPhone string  `json:"contact_phone"`
	Address      string  `json:"address"`
}

// Display picks the institution's name in the reader's language, falling back
// to the one it always has.
func (o Org) Display(lang string) string {
	if lang == "ne" && o.NameNP != "" {
		return o.NameNP
	}
	return o.Name
}

type Image struct {
	ID        string `json:"id"`
	URL       string `json:"url"`
	Alt       string `json:"alt"`
	SortOrder int    `json:"sort_order"`
}

type Property struct {
	ID           string   `json:"id"`
	Slug         string   `json:"slug"`
	Title        string   `json:"title"`
	Type         string   `json:"type"`
	Province     string   `json:"province"`
	District     string   `json:"district"`
	Municipality string   `json:"municipality"`
	Ward         *int     `json:"ward"`
	Address      string   `json:"address"`
	Description  string   `json:"description"`
	LandAreaAana *float64 `json:"land_area_aana"`
	LandAreaSqm  *float64 `json:"land_area_sqm"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
	ViewCount    int      `json:"view_count"`
	RoadAccess   string   `json:"road_access"`
	Facing       string   `json:"facing"`
	Floors       *int     `json:"building_floors"`
	BuiltYear    *int     `json:"built_year"`
	Bedrooms     *int     `json:"bedrooms"`
	Bathrooms    *int     `json:"bathrooms"`
	Organization Org      `json:"organization"`
	Images       []Image  `json:"images"`
}

// Cover is the image a card shows, or empty when the property has none.
func (p Property) Cover() string {
	if len(p.Images) == 0 {
		return ""
	}
	return p.Images[0].URL
}

// Where reads as a place rather than a list of columns.
//
// A metropolitan city usually carries its district's name, so joining the two
// produces "Kathmandu, Kathmandu" for a great many of these properties.
func (p Property) Where() string {
	if p.Municipality == "" || strings.EqualFold(p.Municipality, p.District) {
		return p.District
	}
	return p.Municipality + ", " + p.District
}

type Card struct {
	ID                 string    `json:"id"`
	Round              int       `json:"round"`
	NoticeNumber       string    `json:"notice_number"`
	Status             string    `json:"status"`
	DisplayStatus      string    `json:"display_status"`
	SubmissionDeadline time.Time `json:"submission_deadline"`
	OpeningDatetime    time.Time `json:"opening_datetime"`
	MinimumBid         float64   `json:"minimum_bid"`
	WinningAmount      *float64  `json:"winning_amount"`
	Property           Property  `json:"property"`
}

// Open reports whether bids are still being taken, using the status the
// database derives rather than the stored one — a notice stays 'open' in the
// table after its deadline passes.
func (c Card) Open() bool { return c.DisplayStatus == "open" }

// Remaining is how long is left, or zero once the deadline has gone.
func (c Card) Remaining() time.Duration {
	d := time.Until(c.SubmissionDeadline)
	if d < 0 {
		return 0
	}
	return d
}

type DistrictCount struct {
	District string `json:"district"`
	Count    int    `json:"count"`
}

type HomeData struct {
	OpenCount int             `json:"open_count"`
	OpenValue float64         `json:"open_value"`
	Districts []DistrictCount `json:"districts"`
	Featured  []Card          `json:"featured"`
}

type IndexData struct {
	Total int    `json:"total"`
	Items []Card `json:"items"`
	// Plain names here, unlike the home page's counted ones: the filter only
	// needs to offer the district, and the count beside it would be the count
	// before filtering, which reads as wrong once a filter is applied.
	Districts     []string       `json:"districts"`
	Organizations []Org          `json:"organizations"`
	StatusCounts  map[string]int `json:"status_counts"`
}

// Listing is one auction with everything its page shows.
type Listing struct {
	ID                 string    `json:"id"`
	Round              int       `json:"round"`
	NoticeNumber       string    `json:"notice_number"`
	Status             string    `json:"status"`
	SubmissionDeadline time.Time `json:"submission_deadline"`
	OpeningDatetime    time.Time `json:"opening_datetime"`
	MinimumBid         float64   `json:"minimum_bid"`
	BidSecurityAmount  float64   `json:"bid_security_amount"`
	AppraisedValue     *float64  `json:"appraised_value"`
	WinningAmount      *float64  `json:"winning_amount"`
	OpeningVenue       string    `json:"opening_venue"`
	Terms              string    `json:"terms"`
	RequiredDocuments  string    `json:"required_documents"`
	NoticePDFURL       *string   `json:"notice_pdf_url"`
	Property           Property  `json:"property"`
}

// Open mirrors Card.Open, derived here because this document carries the
// stored status rather than the display one.
func (l Listing) Open() bool {
	return l.Status == "open" && time.Now().Before(l.SubmissionDeadline)
}

// SecurityPercent is the bid security as a share of the minimum bid, which is
// how the notice states it.
func (l Listing) SecurityPercent() string {
	if l.MinimumBid == 0 {
		return "0"
	}
	pct := l.BidSecurityAmount / l.MinimumBid * 100
	return trimZero(pct)
}

func trimZero(f float64) string {
	s := make([]byte, 0, 8)
	whole := int64(f)
	frac := int64((f - float64(whole)) * 10)
	s = appendInt(s, whole)
	if frac > 0 {
		s = append(s, '.')
		s = appendInt(s, frac)
	}
	return string(s)
}

func appendInt(b []byte, n int64) []byte {
	if n == 0 {
		return append(b, '0')
	}
	var tmp [20]byte
	i := len(tmp)
	for n > 0 {
		i--
		tmp[i] = byte('0' + n%10)
		n /= 10
	}
	return append(b, tmp[i:]...)
}

func (s *Server) home(ctx context.Context) (HomeData, error) {
	var out HomeData
	raw, err := s.db.HomeSummary(ctx)
	if err != nil {
		return out, err
	}
	return out, json.Unmarshal(raw, &out)
}

func (s *Server) index(ctx context.Context, p IndexParams) (IndexData, error) {
	var out IndexData
	raw, err := s.db.AuctionsIndex(ctx, p.toDB())
	if err != nil {
		return out, err
	}
	return out, json.Unmarshal(raw, &out)
}

// listing returns nil when nothing is published under that slug, which the
// handler turns into a 404.
func (s *Server) listing(ctx context.Context, slug string) (*Listing, error) {
	raw, err := s.db.Listing(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		// Nothing published under that slug. An address a reader can type is
		// an address they can get wrong, so this is an answer rather than a
		// failure.
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var out Listing
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
