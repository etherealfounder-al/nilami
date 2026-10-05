package db

import (
	"context"

	"github.com/UjjwolKayastha/nilami/api/internal/auth"
	"github.com/google/uuid"
)

// The admin reads. Every one is scoped by the caller's institution in SQL, so a
// handler cannot forget to filter: the predicate is part of the query, not
// something applied to its results afterwards.
//
// tenant is that predicate. The exemption is an explicit boolean rather than a
// sentinel id, for the reason Scope.Tenant documents.
const tenant = `($2 or p.organization_id = $1)`

// Dashboard is the panel's landing page: the counts and the few recent rows it
// shows, in one query instead of the three the page used to make.
func (d *DB) Dashboard(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		with scoped as (
			select p.id from properties p where ` + tenant + `
		),
		auction_rows as (
			select a.* from auctions a where a.property_id in (select id from scoped)
		)
		select jsonb_build_object(
			'properties', (select count(*) from scoped),
			'published',  (select count(*) from properties p where ` + tenant + ` and p.is_published),
			'auctions',   (select count(*) from auction_rows),
			'open',       (select count(*) from auction_rows
			                where status = 'open' and submission_deadline >= now()),
			'closing_soon', (select count(*) from auction_rows
			                  where status = 'open' and submission_deadline >= now()
			                    and submission_deadline < now() + interval '7 days'),
			'bidders',    (select count(*) from bidder_records b
			                where b.auction_id in (select id from auction_rows)),
			'pending_deposits', (select count(*) from bidder_records b
			                      where b.auction_id in (select id from auction_rows)
			                        and b.deposit_status = 'pending'),
			'recent', coalesce((
				select jsonb_agg(r order by r.updated_at desc)
				  from (
					select a.id, a.notice_number, a.status, a.submission_deadline,
					       a.updated_at, p.title, p.slug
					  from auctions a
					  join properties p on p.id = a.property_id
					 where ` + tenant + `
					 order by a.updated_at desc
					 limit 5
				  ) r
			), '[]'::jsonb)
		)`
	return d.JSON(ctx, q, org, all)
}

// PropertiesList is the properties table in the panel.
func (d *DB) PropertiesList(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select coalesce(jsonb_agg(row order by row->>'created_at' desc), '[]'::jsonb)
		  from (
			select jsonb_build_object(
				'id', p.id, 'slug', p.slug, 'title', p.title, 'type', p.type,
				'district', p.district, 'municipality', p.municipality,
				'is_published', p.is_published, 'created_at', p.created_at,
				'organization_id', p.organization_id,
				'organization_name', o.name,
				'image_count', (select count(*) from property_images i
				                 where i.property_id = p.id),
				-- The table shows a thumbnail, so the first image comes with the
				-- row rather than the page fetching every image to find it.
				'cover_url', (select i.url from property_images i
				               where i.property_id = p.id
				               order by i.sort_order, i.created_at limit 1),
				'auction_count', (select count(*) from auctions a
				                   where a.property_id = p.id),
				'view_count', coalesce(v.view_count, 0)
			) as row
			  from properties p
			  join organizations o on o.id = p.organization_id
			  left join property_view_stats v on v.property_id = p.id
			 where ` + tenant + `
		  ) t`
	return d.JSON(ctx, q, org, all)
}

// AuctionsList is the auctions table in the panel. It carries displayStatus for
// the same reason the public index does: so the badge cannot disagree with the
// filter next to it.
func (d *DB) AuctionsList(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	q := `
		select coalesce(jsonb_agg(row order by row->>'submission_deadline' desc), '[]'::jsonb)
		  from (
			select jsonb_build_object(
				'id', a.id, 'notice_number', a.notice_number, 'round', a.round,
				'status', a.status, 'display_status', ` + displayStatus + `,
				'submission_deadline', a.submission_deadline,
				'opening_datetime', a.opening_datetime,
				'minimum_bid', a.minimum_bid, 'winning_amount', a.winning_amount,
				'updated_at', a.updated_at,
				'property', jsonb_build_object(
					'id', p.id, 'slug', p.slug, 'title', p.title,
					'district', p.district, 'is_published', p.is_published,
					-- The counter belongs to the property, so every round of a
					-- re-auctioned listing reports the same total.
					'view_count', coalesce(v.view_count, 0)
				),
				'organization_name', o.name,
				'bidder_count', (select count(*) from bidder_records b
				                  where b.auction_id = a.id)
			) as row
			  from auctions a
			  join properties p on p.id = a.property_id
			  join organizations o on o.id = p.organization_id
			  left join property_view_stats v on v.property_id = p.id
			 where ` + tenant + `
		  ) t`
	return d.JSON(ctx, q, org, all)
}

// AuctionDetail backs the auction edit form.
func (d *DB) AuctionDetail(ctx context.Context, s auth.Scope, id string) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select to_jsonb(a) || jsonb_build_object(
			'property', jsonb_build_object(
				'id', p.id, 'slug', p.slug, 'title', p.title,
				'district', p.district, 'is_published', p.is_published
			)
		)
		  from auctions a
		  join properties p on p.id = a.property_id
		 where a.id = $3 and ` + tenant
	return d.JSON(ctx, q, org, all, id)
}

// PropertyDetail backs the property edit form, images included.
func (d *DB) PropertyDetail(ctx context.Context, s auth.Scope, id string) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select to_jsonb(p) || jsonb_build_object(
			'images', coalesce((
				select jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at)
				  from property_images i where i.property_id = p.id
			), '[]'::jsonb)
		)
		  from properties p
		 where p.id = $3 and ` + tenant
	return d.JSON(ctx, q, org, all, id)
}

// Bidders lists the bidder records for one auction, after confirming the auction
// belongs to the caller's institution. Without that join a staff member could
// read any institution's bidders by guessing an auction id — personal data, so
// the check matters more here than anywhere else.
func (d *DB) Bidders(ctx context.Context, s auth.Scope, auctionID string) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at), '[]'::jsonb)
		  from bidder_records b
		  join auctions a on a.id = b.auction_id
		  join properties p on p.id = a.property_id
		 where b.auction_id = $3 and ` + tenant
	return d.JSON(ctx, q, org, all, auctionID)
}

// Staff is the approval queue and the roster.
//
// Platform administrators are listed with their institution as null, which is
// what they are. The signup escalation worked precisely because a null
// institution was indistinguishable from "no institution chosen", so the name is
// rendered from the joined row rather than invented when it is missing.
func (d *DB) Staff(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select coalesce(jsonb_agg(row order by row->>'created_at' desc), '[]'::jsonb)
		  from (
			select jsonb_build_object(
				'id', pr.id, 'full_name', pr.full_name, 'email', pr.email,
				'role', pr.role, 'approved', pr.approved,
				'created_at', pr.created_at,
				'organization_id', pr.organization_id,
				'organization_name', o.name,
				-- The queue marks an institution nobody has admitted yet, so
				-- approving its first member is visibly a bigger decision than
				-- adding someone to an institution already operating.
				'organization_approved', o.approved
			) as row
			  from profiles pr
			  left join organizations o on o.id = pr.organization_id
			 where ($2 or pr.organization_id = $1)
		  ) t`
	return d.JSON(ctx, q, org, all)
}

// Institution returns the branding record the settings form edits. A platform
// admin may ask for any institution by id; staff always get their own, whatever
// they ask for.
func (d *DB) Institution(ctx context.Context, s auth.Scope, requested string) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select to_jsonb(o)
		  from organizations o
		 where o.id = case
		        when $2 and nullif($3, '') is not null then $3::uuid
		        when $2 then o.id
		        else $1
		       end
		 order by o.name
		 limit 1`
	return d.JSON(ctx, q, org, all, requested)
}

// InstitutionOptions feeds the platform admin's institution picker.
func (d *DB) InstitutionOptions(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select coalesce(jsonb_agg(jsonb_build_object(
			'id', o.id, 'name', o.name, 'slug', o.slug, 'approved', o.approved
		) order by o.name), '[]'::jsonb)
		  from organizations o
		 where ($2 or o.id = $1)`
	return d.JSON(ctx, q, org, all)
}

// Viewer is everything the panel's chrome needs: who is signed in, whose view
// they are seeing, and the institutions they may switch between.
//
// It exists so the layout does not have to ask three questions over a link to
// another continent, and so the answers cannot disagree with each other.
func (d *DB) Viewer(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()

	// The proxied scope carries the target's id; the real administrator's is in
	// ProxiedBy. Reporting both is what lets the panel say whose view this is
	// while still naming the account responsible for anything done in it.
	real := s.UserID
	if s.Proxied() {
		real = s.ProxiedBy
	}

	const q = `
		select jsonb_build_object(
			'user_id', $3::uuid,
			'organization_id', nullif($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid),
			'is_platform_admin', $2::boolean,
			'viewing_as', case when $4::uuid is null then null else (
				select jsonb_build_object(
					'id', p.id,
					'full_name', coalesce(nullif(p.full_name, ''), p.email),
					'email', p.email,
					'organization_id', p.organization_id,
					'organization_name', coalesce(o.name, 'Platform Admin')
				)
				  from profiles p
				  left join organizations o on o.id = p.organization_id
				 where p.id = $4::uuid
			) end,
			'organizations', coalesce((
				select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) order by o.name)
				  from organizations o
				 where ($2::boolean or o.id = $1::uuid)
			), '[]'::jsonb)
		)`

	var proxied *uuid.UUID
	if s.Proxied() {
		id := s.UserID
		proxied = &id
	}
	return d.JSON(ctx, q, org, all, real, proxied)
}

// AllBidders is the bidder-records page: every bidder in the caller's scope,
// newest first, with the auction and property it belongs to. Personal data, so
// it goes through the same tenant predicate as everything else.
func (d *DB) AllBidders(ctx context.Context, s auth.Scope) ([]byte, error) {
	org, all := s.Tenant()
	const q = `
		select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object(
			'auction', jsonb_build_object(
				'notice_number', a.notice_number,
				'property', jsonb_build_object('title', p.title)
			)
		) order by b.created_at desc), '[]'::jsonb)
		  from bidder_records b
		  join auctions a on a.id = b.auction_id
		  join properties p on p.id = a.property_id
		 where ` + tenant
	return d.JSON(ctx, q, org, all)
}
