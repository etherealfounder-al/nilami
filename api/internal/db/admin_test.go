package db

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
)

// These tests exist for one reason: row level security used to stop an
// institution reading another's rows, and it no longer does. The predicate that
// replaced it is ordinary SQL in ordinary functions, which means it can be got
// wrong by an ordinary mistake — so the isolation is asserted here rather than
// assumed.

func testDB(t *testing.T) *DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	d, err := Open(context.Background(), url, 4)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if err := d.Migrate(context.Background()); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(d.Pool.Close)
	return d
}

type fixture struct {
	orgA, orgB         uuid.UUID
	staffA, staffB     uuid.UUID
	platform           uuid.UUID
	propA, propB       uuid.UUID
	auctionA, auctionB uuid.UUID
}

func seed(t *testing.T, d *DB) fixture {
	t.Helper()
	ctx := context.Background()
	for _, q := range []string{
		`delete from bidder_records`, `delete from property_view_stats`,
		`delete from property_images`, `delete from auctions`,
		`delete from properties`, `delete from profiles`, `delete from organizations`,
	} {
		if _, err := d.Pool.Exec(ctx, q); err != nil {
			t.Fatalf("clean: %v", err)
		}
	}

	f := fixture{}
	mk := func(slug, name string) uuid.UUID {
		var id uuid.UUID
		err := d.Pool.QueryRow(ctx,
			`insert into organizations (slug, name, approved) values ($1,$2,true) returning id`,
			slug, name).Scan(&id)
		if err != nil {
			t.Fatalf("org: %v", err)
		}
		return id
	}
	f.orgA, f.orgB = mk("alpha", "Alpha Bank"), mk("beta", "Beta Finance")

	prof := func(org *uuid.UUID, email string) uuid.UUID {
		id := uuid.New()
		_, err := d.Pool.Exec(ctx,
			`insert into profiles (id, email, organization_id, approved) values ($1,$2,$3,true)`,
			id, email, org)
		if err != nil {
			t.Fatalf("profile: %v", err)
		}
		return id
	}
	f.staffA, f.staffB = prof(&f.orgA, "a@x.test"), prof(&f.orgB, "b@x.test")
	f.platform = prof(nil, "root@x.test")

	prop := func(org uuid.UUID, slug, title string) uuid.UUID {
		var id uuid.UUID
		err := d.Pool.QueryRow(ctx, `
			insert into properties (slug, title, type, province, district, municipality,
			                        is_published, organization_id)
			values ($1,$2,'house','Bagmati','Kathmandu','KMC',true,$3) returning id`,
			slug, title, org).Scan(&id)
		if err != nil {
			t.Fatalf("property: %v", err)
		}
		return id
	}
	f.propA, f.propB = prop(f.orgA, "alpha-house", "Alpha House"), prop(f.orgB, "beta-house", "Beta House")

	auc := func(prop uuid.UUID, notice string) uuid.UUID {
		var id uuid.UUID
		err := d.Pool.QueryRow(ctx, `
			insert into auctions (property_id, notice_number, submission_deadline,
			                      opening_datetime, minimum_bid, bid_security_amount, status)
			values ($1,$2, now()+interval '7 days', now()+interval '8 days', 1000, 100, 'open')
			returning id`, prop, notice).Scan(&id)
		if err != nil {
			t.Fatalf("auction: %v", err)
		}
		return id
	}
	f.auctionA, f.auctionB = auc(f.propA, "A-1"), auc(f.propB, "B-1")

	for _, a := range []uuid.UUID{f.auctionA, f.auctionB} {
		if _, err := d.Pool.Exec(ctx,
			`insert into bidder_records (auction_id, full_name, phone) values ($1,'Someone','98')`,
			a); err != nil {
			t.Fatalf("bidder: %v", err)
		}
	}
	return f
}

func staffScope(user, org uuid.UUID) auth.Scope {
	return auth.Scope{UserID: user, OrganizationID: org, Approved: true}
}

func platformScope(user uuid.UUID) auth.Scope {
	return auth.Scope{UserID: user, IsPlatformAdmin: true, Approved: true}
}

func decodeList(t *testing.T, doc []byte, err error) []map[string]any {
	t.Helper()
	if err != nil {
		t.Fatalf("query: %v", err)
	}
	var rows []map[string]any
	if err := json.Unmarshal(doc, &rows); err != nil {
		t.Fatalf("decode %s: %v", doc, err)
	}
	return rows
}

func TestInstitutionsAreIsolated(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	propsDoc, propsErr := d.PropertiesList(ctx, staffScope(f.staffA, f.orgA))
	props := decodeList(t, propsDoc, propsErr)
	if len(props) != 1 || props[0]["title"] != "Alpha House" {
		t.Fatalf("staff A should see only their own property, got %v", props)
	}

	aucsDoc, aucsErr := d.AuctionsList(ctx, staffScope(f.staffB, f.orgB))
	aucs := decodeList(t, aucsDoc, aucsErr)
	if len(aucs) != 1 || aucs[0]["notice_number"] != "B-1" {
		t.Fatalf("staff B should see only their own auction, got %v", aucs)
	}

	allDoc, allErr := d.PropertiesList(ctx, platformScope(f.platform))
	all := decodeList(t, allDoc, allErr)
	if len(all) != 2 {
		t.Fatalf("platform admin should see both, got %d", len(all))
	}
}

// Guessing another institution's id must not be enough to read its rows. The id
// is a filter; the scope is the authority.
func TestForeignIDsReturnNothing(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	if _, err := d.PropertyDetail(ctx, staffScope(f.staffA, f.orgA), f.propB.String()); err == nil {
		t.Fatal("staff A read institution B's property by id")
	}
	if _, err := d.AuctionDetail(ctx, staffScope(f.staffA, f.orgA), f.auctionB.String()); err == nil {
		t.Fatal("staff A read institution B's auction by id")
	}

	// Bidder records are personal data, so this is the one that matters most.
	biddersDoc, biddersErr := d.Bidders(ctx, staffScope(f.staffA, f.orgA), f.auctionB.String())
	bidders := decodeList(t, biddersDoc, biddersErr)
	if len(bidders) != 0 {
		t.Fatalf("staff A read institution B's bidders: %v", bidders)
	}
	ownDoc, ownErr := d.Bidders(ctx, staffScope(f.staffA, f.orgA), f.auctionA.String())
	own := decodeList(t, ownDoc, ownErr)
	if len(own) != 1 {
		t.Fatalf("staff A should see their own bidders, got %d", len(own))
	}
}

// An unapproved or unresolved profile must see nothing. This is the case the
// old nil-uuid sentinel made dangerous: it meant both "platform admin" and
// "nobody", and a query reading it the obvious way returned everything.
func TestUnresolvedScopeSeesNothing(t *testing.T) {
	d := testDB(t)
	seed(t, d)
	ctx := context.Background()

	empty := auth.Scope{UserID: uuid.New()} // no org, not platform, not approved
	propsDoc, propsErr := d.PropertiesList(ctx, empty)
	props := decodeList(t, propsDoc, propsErr)
	if len(props) != 0 {
		t.Fatalf("an unresolved profile saw %d properties", len(props))
	}
	staffDoc, staffErr := d.Staff(ctx, empty)
	staff := decodeList(t, staffDoc, staffErr)
	if len(staff) != 0 {
		t.Fatalf("an unresolved profile saw %d profiles", len(staff))
	}
}

func TestViewAsOnlyNarrowsAndOnlyForPlatformAdmins(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	// Institution staff sending the header gain nothing.
	got, err := d.ScopeForViewAs(ctx, staffScope(f.staffA, f.orgA), f.staffB)
	if err != nil {
		t.Fatalf("view-as: %v", err)
	}
	if got.OrganizationID != f.orgA || got.Proxied() {
		t.Fatalf("staff escalated through X-View-As: %+v", got)
	}

	// A platform admin narrows into the target's institution.
	got, err = d.ScopeForViewAs(ctx, platformScope(f.platform), f.staffB)
	if err != nil {
		t.Fatalf("view-as: %v", err)
	}
	if got.OrganizationID != f.orgB || got.IsPlatformAdmin || !got.Proxied() {
		t.Fatalf("platform admin did not narrow into B: %+v", got)
	}
	if got.ProxiedBy != f.platform {
		t.Fatalf("proxy not attributed to the real account: %+v", got)
	}

	// And while proxied, platform-only powers are refused.
	if _, err := auth.RequirePlatformAdmin(auth.WithScope(ctx, got)); err == nil {
		t.Fatal("platform powers survived a view-as")
	}

	// An unapproved target drops back to the admin's own view.
	unapproved := uuid.New()
	if _, err := d.Pool.Exec(ctx,
		`insert into profiles (id, email, organization_id, approved) values ($1,'u@x.test',$2,false)`,
		unapproved, f.orgB); err != nil {
		t.Fatalf("seed unapproved: %v", err)
	}
	got, err = d.ScopeForViewAs(ctx, platformScope(f.platform), unapproved)
	if err != nil {
		t.Fatalf("view-as: %v", err)
	}
	if got.Proxied() || !got.IsPlatformAdmin {
		t.Fatalf("proxied into an unapproved account: %+v", got)
	}
}

func TestBrandingRefusesForeignInstitutions(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()
	b := OrganizationBranding{ContactEmail: "new@x.test"}

	if err := d.UpdateBranding(ctx, staffScope(f.staffA, f.orgA), f.orgB, b); err == nil {
		t.Fatal("staff A edited institution B")
	}
	if err := d.UpdateBranding(ctx, staffScope(f.staffA, f.orgA), f.orgA, b); err != nil {
		t.Fatalf("staff A could not edit their own institution: %v", err)
	}
	if err := d.UpdateBranding(ctx, platformScope(f.platform), f.orgB, b); err != nil {
		t.Fatalf("platform admin could not edit B: %v", err)
	}
}

func TestRejectStaffRefusesSelf(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()
	if err := d.RejectStaff(ctx, platformScope(f.platform), f.platform); err != ErrSelfReject {
		t.Fatalf("expected self-rejection to be refused, got %v", err)
	}
}

// Approval admits the institution along with its first member, which is how a
// requested institution becomes live.
func TestApproveStaffApprovesTheInstitution(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	if _, err := d.Pool.Exec(ctx, `update organizations set approved = false where id = $1`, f.orgA); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := d.ApproveStaff(ctx, platformScope(f.platform), f.staffA); err != nil {
		t.Fatalf("approve: %v", err)
	}
	var orgApproved, profApproved bool
	if err := d.Pool.QueryRow(ctx,
		`select o.approved, p.approved from organizations o
		   join profiles p on p.organization_id = o.id
		  where o.id = $1 and p.id = $2`, f.orgA, f.staffA).Scan(&orgApproved, &profApproved); err != nil {
		t.Fatalf("read back: %v", err)
	}
	if !orgApproved || !profApproved {
		t.Fatalf("approval did not cascade: org=%v profile=%v", orgApproved, profApproved)
	}
	if err := d.ApproveStaff(ctx, platformScope(f.platform), uuid.New()); err != ErrNotFound {
		t.Fatalf("approving a missing profile should be ErrNotFound, got %v", err)
	}
}

func TestRequestOrganizationValidatesAndDeduplicates(t *testing.T) {
	d := testDB(t)
	seed(t, d)
	ctx := context.Background()

	for _, bad := range []struct{ name, email string }{
		{"ab", "x@y.test"},             // too short
		{"Valid Name", "not-an-email"}, // malformed address
		{"Valid Name", ""},             // absent address
	} {
		if _, err := d.RequestOrganization(ctx, bad.name, "", bad.email, "", ""); err != ErrValidation {
			t.Fatalf("expected validation failure for %q/%q, got %v", bad.name, bad.email, err)
		}
	}

	// The same name twice must not collide on the unique slug.
	first, err := d.RequestOrganization(ctx, "Nepal Trust Bank", "", "a@b.test", "", "")
	if err != nil {
		t.Fatalf("first request: %v", err)
	}
	second, err := d.RequestOrganization(ctx, "Nepal Trust Bank", "", "a@b.test", "", "")
	if err != nil {
		t.Fatalf("second request: %v", err)
	}
	var slugs []string
	rows, err := d.Pool.Query(ctx, `select slug from organizations where id = any($1) order by slug`,
		[]uuid.UUID{first, second})
	if err != nil {
		t.Fatalf("slugs: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatal(err)
		}
		slugs = append(slugs, s)
	}
	if len(slugs) != 2 || slugs[0] != "nepal-trust-bank" || slugs[1] != "nepal-trust-bank-2" {
		t.Fatalf("slug de-duplication failed: %v", slugs)
	}
}

// The cap is the only thing between the approval queue and a script, since this
// is the one write an unauthenticated caller may make.
func TestRequestOrganizationCapsPendingRequests(t *testing.T) {
	d := testDB(t)
	seed(t, d)
	ctx := context.Background()

	for i := 0; i < maxPendingOrgs; i++ {
		if _, err := d.RequestOrganization(ctx, "Pending Institution", "", "p@q.test", "", ""); err != nil {
			t.Fatalf("request %d: %v", i, err)
		}
	}
	if _, err := d.RequestOrganization(ctx, "One Too Many", "", "p@q.test", "", ""); err != ErrValidation {
		t.Fatalf("the cap did not hold, got %v", err)
	}
}

func TestRecordPropertyViewOnlyCountsPublished(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	n, err := d.RecordPropertyView(ctx, "alpha-house")
	if err != nil || n != 1 {
		t.Fatalf("first view: n=%d err=%v", n, err)
	}
	if n, err = d.RecordPropertyView(ctx, "alpha-house"); err != nil || n != 2 {
		t.Fatalf("second view: n=%d err=%v", n, err)
	}

	if _, err := d.Pool.Exec(ctx, `update properties set is_published = false where id = $1`, f.propB); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := d.RecordPropertyView(ctx, "beta-house"); err != ErrNotFound {
		t.Fatalf("an unpublished listing was counted: %v", err)
	}
	if _, err := d.RecordPropertyView(ctx, "no-such-slug"); err != ErrNotFound {
		t.Fatalf("an unknown slug was counted: %v", err)
	}
}

// The panel's chrome has to name the right account. While proxied it shows the
// target's institution but must still attribute the session to the real
// administrator, or an audit trail points at the wrong person.
func TestViewerReportsBothAccountsWhileProxied(t *testing.T) {
	d := testDB(t)
	f := seed(t, d)
	ctx := context.Background()

	decode := func(doc []byte, err error) map[string]any {
		t.Helper()
		if err != nil {
			t.Fatalf("viewer: %v", err)
		}
		var m map[string]any
		if err := json.Unmarshal(doc, &m); err != nil {
			t.Fatalf("decode %s: %v", doc, err)
		}
		return m
	}

	// Signed in as themselves.
	own := decode(d.Viewer(ctx, platformScope(f.platform)))
	if own["user_id"] != f.platform.String() {
		t.Fatalf("wrong account reported: %v", own["user_id"])
	}
	if own["viewing_as"] != nil {
		t.Fatalf("a plain session reported a proxy: %v", own["viewing_as"])
	}
	if own["is_platform_admin"] != true {
		t.Fatalf("platform admin not reported: %v", own["is_platform_admin"])
	}
	if len(own["organizations"].([]any)) != 2 {
		t.Fatalf("platform admin should see both institutions: %v", own["organizations"])
	}

	// Proxied into institution staff.
	proxied, err := d.ScopeForViewAs(ctx, platformScope(f.platform), f.staffB)
	if err != nil {
		t.Fatal(err)
	}
	as := decode(d.Viewer(ctx, proxied))
	if as["user_id"] != f.platform.String() {
		t.Fatalf("proxied session attributed to the borrowed account, not the real one: %v", as["user_id"])
	}
	target, ok := as["viewing_as"].(map[string]any)
	if !ok {
		t.Fatalf("no proxy target reported: %v", as["viewing_as"])
	}
	if target["id"] != f.staffB.String() || target["organization_name"] != "Beta Finance" {
		t.Fatalf("wrong proxy target: %v", target)
	}
	// And the institution list narrows to the one being viewed.
	if len(as["organizations"].([]any)) != 1 {
		t.Fatalf("proxied institution list did not narrow: %v", as["organizations"])
	}

	// Institution staff see only their own.
	staff := decode(d.Viewer(ctx, staffScope(f.staffA, f.orgA)))
	if staff["is_platform_admin"] != false || staff["organization_id"] != f.orgA.String() {
		t.Fatalf("staff viewer wrong: %v", staff)
	}
}
