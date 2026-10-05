package db

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

// The writes carry the same tenant predicate as the reads, and these tests
// assert it from the attacker's side: staff of one institution aiming every
// write at another's rows, by id.

func TestWritesCannotReachAnotherInstitution(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()
	a := staffScope(f.staffA, f.orgA)

	if _, err := d.SaveProperty(ctx, a, &f.propB, PropertyInput{Title: "Hijacked", Type: "house"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("update foreign property: want ErrNotFound, got %v", err)
	}
	if err := d.DeleteProperty(ctx, a, f.propB); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete foreign property: want ErrNotFound, got %v", err)
	}
	in := AuctionInput{PropertyID: f.propB, SubmissionDeadline: time.Now().Add(time.Hour),
		OpeningDatetime: time.Now().Add(2 * time.Hour), Status: "draft"}
	if _, err := d.SaveAuction(ctx, a, nil, in); !errors.Is(err, ErrNotFound) {
		t.Fatalf("auction on foreign property: want ErrNotFound, got %v", err)
	}
	// Re-pointing their own auction is refused too when the target is foreign.
	if _, err := d.SaveAuction(ctx, a, &f.auctionA, in); !errors.Is(err, ErrNotFound) {
		t.Fatalf("move auction to foreign property: want ErrNotFound, got %v", err)
	}
	in.PropertyID = f.propA
	if _, err := d.SaveAuction(ctx, a, &f.auctionB, in); !errors.Is(err, ErrNotFound) {
		t.Fatalf("update foreign auction: want ErrNotFound, got %v", err)
	}
	if err := d.SetAuctionStatus(ctx, a, f.auctionB, "cancelled"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("status of foreign auction: want ErrNotFound, got %v", err)
	}
	if _, err := d.AddBidder(ctx, a, BidderInput{AuctionID: f.auctionB, FullName: "X"}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("bidder on foreign auction: want ErrNotFound, got %v", err)
	}

	var bidderB uuid.UUID
	if err := d.Pool.QueryRow(ctx, `select id from bidder_records where auction_id = $1`, f.auctionB).Scan(&bidderB); err != nil {
		t.Fatal(err)
	}
	if err := d.SetBidderStatus(ctx, a, bidderB, "verified"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign bidder status: want ErrNotFound, got %v", err)
	}
	if err := d.DeleteBidder(ctx, a, bidderB); !errors.Is(err, ErrNotFound) {
		t.Fatalf("delete foreign bidder: want ErrNotFound, got %v", err)
	}

	// The bidder list is scoped too: A sees only its own bidder.
	doc, err := d.AllBidders(ctx, a)
	rows := decodeList(t, doc, err)
	if len(rows) != 1 || rows[0]["auction_id"] != f.auctionA.String() {
		t.Fatalf("AllBidders leaked across institutions: %v", rows)
	}

	// And nothing of B's changed.
	var title, status string
	var bidders int
	if err := d.Pool.QueryRow(ctx, `
		select p.title, a.status::text, (select count(*) from bidder_records where auction_id = a.id)
		  from properties p join auctions a on a.property_id = p.id where p.id = $1`, f.propB).
		Scan(&title, &status, &bidders); err != nil {
		t.Fatal(err)
	}
	if title != "Beta House" || status != "open" || bidders != 1 {
		t.Fatalf("institution B was modified: %q %q %d", title, status, bidders)
	}
}

func TestStaffWritesLandInTheirOwnInstitution(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()
	a := staffScope(f.staffA, f.orgA)

	// Naming institution B in the body is ignored for staff.
	id, err := d.SaveProperty(ctx, a, nil, PropertyInput{
		OrganizationID: &f.orgB, Title: "New Plot", Type: "land",
		Province: "Bagmati", District: "Lalitpur", Municipality: "LMC",
		ImageURLs: []string{"https://cdn.example/a.jpg", " ", "https://cdn.example/b.jpg"},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	var org uuid.UUID
	var slug string
	var images int
	if err := d.Pool.QueryRow(ctx, `
		select organization_id, slug, (select count(*) from property_images where property_id = p.id)
		  from properties p where id = $1`, id).Scan(&org, &slug, &images); err != nil {
		t.Fatal(err)
	}
	if org != f.orgA || slug != "new-plot" || images != 2 {
		t.Fatalf("got org=%v slug=%q images=%d", org, slug, images)
	}

	// A duplicate slug is a conflict the form can report, not a 500.
	if _, err := d.SaveProperty(ctx, a, nil, PropertyInput{Title: "New Plot", Type: "land",
		Province: "B", District: "L", Municipality: "M"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate slug: want ErrConflict, got %v", err)
	}
	// A non-https image is refused.
	if _, err := d.SaveProperty(ctx, a, &id, PropertyInput{Title: "New Plot", Type: "land",
		ImageURLs: []string{"javascript:alert(1)"}}); !errors.Is(err, ErrValidation) {
		t.Fatalf("bad image url: want ErrValidation, got %v", err)
	}
	// An unknown enum value is a validation error, not a 500.
	if err := d.SetAuctionStatus(ctx, a, f.auctionA, "bogus"); !errors.Is(err, ErrValidation) {
		t.Fatalf("bad status: want ErrValidation, got %v", err)
	}

	// Saving an auction without notice_pdf_url keeps the one it had.
	if _, err := d.Pool.Exec(ctx, `update auctions set notice_pdf_url = 'https://cdn.example/n.pdf' where id = $1`, f.auctionA); err != nil {
		t.Fatal(err)
	}
	if _, err := d.SaveAuction(ctx, a, &f.auctionA, AuctionInput{PropertyID: f.propA, Status: "open",
		SubmissionDeadline: time.Now().Add(time.Hour), OpeningDatetime: time.Now().Add(2 * time.Hour),
		MinimumBid: 1000, BidSecurityAmount: 100}); err != nil {
		t.Fatalf("save own auction: %v", err)
	}
	var pdf *string
	if err := d.Pool.QueryRow(ctx, `select notice_pdf_url from auctions where id = $1`, f.auctionA).Scan(&pdf); err != nil || pdf == nil {
		t.Fatalf("notice_pdf_url was wiped: %v %v", pdf, err)
	}

	// The full bidder lifecycle works inside the institution.
	bid, err := d.AddBidder(ctx, a, BidderInput{AuctionID: f.auctionA, FullName: " Ram "})
	if err != nil {
		t.Fatalf("add bidder: %v", err)
	}
	if err := d.SetBidderStatus(ctx, a, bid, "verified"); err != nil {
		t.Fatalf("bidder status: %v", err)
	}
	if err := d.DeleteBidder(ctx, a, bid); err != nil {
		t.Fatalf("delete bidder: %v", err)
	}
	if err := d.DeleteProperty(ctx, a, id); err != nil {
		t.Fatalf("delete own property: %v", err)
	}
}

func TestPlatformAdminMustNameAnExistingInstitution(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()
	p := platformScope(f.platform)

	base := PropertyInput{Title: "Admin Plot", Type: "land", Province: "B", District: "K", Municipality: "M"}
	if _, err := d.SaveProperty(ctx, p, nil, base); !errors.Is(err, ErrValidation) {
		t.Fatalf("no institution: want ErrValidation, got %v", err)
	}
	ghost := uuid.New()
	base.OrganizationID = &ghost
	if _, err := d.SaveProperty(ctx, p, nil, base); !errors.Is(err, ErrValidation) {
		t.Fatalf("unknown institution: want ErrValidation, got %v", err)
	}
	base.OrganizationID = &f.orgB
	if _, err := d.SaveProperty(ctx, p, nil, base); err != nil {
		t.Fatalf("platform admin into B: %v", err)
	}
}
