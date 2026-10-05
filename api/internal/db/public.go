package db

import "context"

// The public reads. Each returns one JSON document assembled by Postgres.

// publishedAuction is the predicate that decides what the world may see, shared
// by every public query so the rule cannot drift between them.
const publishedAuction = `a.status <> 'draft' and p.is_published`

// propertyJSON is the shape the frontend's Property type expects. Kept in one
// place so the listing page and the index cannot disagree about a field.
const propertyJSON = `
	jsonb_build_object(
		'id', p.id, 'slug', p.slug, 'title', p.title, 'type', p.type,
		'province', p.province, 'district', p.district,
		'municipality', p.municipality, 'ward', p.ward, 'address', p.address,
		'land_area_aana', p.land_area_aana, 'land_area_sqm', p.land_area_sqm,
		'building_floors', p.building_floors, 'built_year', p.built_year,
		'bedrooms', p.bedrooms, 'bathrooms', p.bathrooms,
		'road_access', p.road_access, 'facing', p.facing,
		'description', p.description, 'is_published', p.is_published,
		'organization_id', p.organization_id,
		'latitude', p.latitude, 'longitude', p.longitude,
		'video_url', p.video_url,
		'view_count', coalesce(v.view_count, 0),
		'organization', to_jsonb(o) - 'created_at',
		'images', coalesce((
			select jsonb_agg(to_jsonb(i) order by i.sort_order, i.created_at)
			  from property_images i where i.property_id = p.id
		), '[]'::jsonb)
	)`

// Listing returns everything the detail page renders: the auction, its property,
// images, institution and view count — one hop, one query.
func (d *DB) Listing(ctx context.Context, slug string) ([]byte, error) {
	q := `
		select to_jsonb(a) - 'property_id' || jsonb_build_object('property', ` + propertyJSON + `)
		  from auctions a
		  join properties p on p.id = a.property_id
		  join organizations o on o.id = p.organization_id
		  left join property_view_stats v on v.property_id = p.id
		 where p.slug = $1 and ` + publishedAuction + `
		 order by a.round desc
		 limit 1`
	return d.JSON(ctx, q, slug)
}

// HomeSummary feeds the landing page: headline figures and the per-district
// counts behind the map.
//
// displayStatus is applied here rather than in the frontend, so "open" never
// includes a notice whose deadline has passed — the drift the UI used to paper
// over at render time.
func (d *DB) HomeSummary(ctx context.Context) ([]byte, error) {
	q := `
		with live as (
			select a.minimum_bid, p.district,
			       case when a.status = 'open' and a.submission_deadline < now()
			            then 'closed' else a.status::text end as display_status
			  from auctions a
			  join properties p on p.id = a.property_id
			 where ` + publishedAuction + `
		)
		select jsonb_build_object(
			'open_count', count(*) filter (where display_status = 'open'),
			'open_value', coalesce(sum(minimum_bid) filter (where display_status = 'open'), 0),
			'districts', coalesce((
				select jsonb_agg(jsonb_build_object('district', district, 'count', n))
				  from (select district, count(*) as n from live group by district) t
			), '[]'::jsonb),
			'featured', coalesce((
				select jsonb_agg(c order by c->>'submission_deadline')
				  from (
					select ` + cardJSON + ` as c
					  from auctions a
					  join properties p on p.id = a.property_id
					  join organizations o on o.id = p.organization_id
					 where ` + publishedAuction + `
					 order by a.submission_deadline
					 limit 6
				  ) f
			), '[]'::jsonb)
		)
		  from live`
	return d.JSON(ctx, q)
}

// displayStatus is the status a visitor should see.
//
// The stored status drifts: a notice stays 'open' in the table after its
// deadline passes, because nothing closes it. Deriving the displayed value here
// means the list, the filters and the counts all agree, instead of each page
// correcting it on its own.
const displayStatus = `
	case when a.status = 'open' and a.submission_deadline < now()
	     then 'closed' else a.status::text end`

// cardJSON is what a card in the index renders. Lighter than the detail
// payload, but it carries the images because the card has its own carousel.
const cardJSON = `
	jsonb_build_object(
		'id', a.id, 'round', a.round, 'notice_number', a.notice_number,
		'status', a.status, 'display_status', ` + displayStatus + `,
		'submission_deadline', a.submission_deadline,
		'opening_datetime', a.opening_datetime,
		'minimum_bid', a.minimum_bid, 'winning_amount', a.winning_amount,
		'property', jsonb_build_object(
			'id', p.id, 'slug', p.slug, 'title', p.title, 'type', p.type,
			'province', p.province, 'district', p.district,
			'municipality', p.municipality, 'ward', p.ward,
			'land_area_aana', p.land_area_aana, 'land_area_sqm', p.land_area_sqm,
			'latitude', p.latitude, 'longitude', p.longitude,
			'organization', jsonb_build_object(
				'slug', o.slug, 'name', o.name, 'name_np', o.name_np,
				'logo_url', o.logo_url
			),
			'images', coalesce((
				select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'alt', i.alt, 'sort_order', i.sort_order)
				                 order by i.sort_order, i.created_at)
				  from property_images i where i.property_id = p.id
			), '[]'::jsonb)
		)
	)`

// AuctionsIndexParams mirrors the listing page's query string. Every filter is
// optional; an empty string means "not filtering on this".
type AuctionsIndexParams struct {
	Status   string
	Type     string
	District string
	Org      string
	Query    string
	Limit    int
	Offset   int
}

// AuctionsIndex returns one document holding the page of cards, the total for
// paging, and the facets the filter controls are built from.
//
// The facets come from the unfiltered set on purpose: a district should stay
// selectable after you have filtered it away, or the control becomes a trap you
// cannot back out of.
func (d *DB) AuctionsIndex(ctx context.Context, p AuctionsIndexParams) ([]byte, error) {
	q := `
		with live as (
			select a.id as auction_id, p.id as property_id,
			       a.submission_deadline,
			       ` + displayStatus + ` as display_status,
			       p.type::text as type, p.district, p.municipality, p.title,
			       o.slug as org_slug, o.name as org_name, o.name_np as org_name_np,
			       ` + cardJSON + ` as card
			  from auctions a
			  join properties p on p.id = a.property_id
			  join organizations o on o.id = p.organization_id
			 where ` + publishedAuction + `
		),
		filtered as (
			select * from live
			 where (nullif($1, '') is null or display_status = $1)
			   and (nullif($2, '') is null or type = $2)
			   and (nullif($3, '') is null or lower(district) = lower($3))
			   and (nullif($4, '') is null or org_slug = $4)
			   and (nullif($5, '') is null
			        or title ilike '%' || $5 || '%'
			        or district ilike '%' || $5 || '%'
			        or municipality ilike '%' || $5 || '%')
		)
		select jsonb_build_object(
			'total', (select count(*) from filtered),
			'items', coalesce((
				select jsonb_agg(card order by submission_deadline)
				  from (select card, submission_deadline from filtered
				         order by submission_deadline limit $6 offset $7) page
			), '[]'::jsonb),
			'districts', coalesce((
				select jsonb_agg(distinct district order by district) from live
			), '[]'::jsonb),
			'organizations', coalesce((
				select jsonb_agg(org order by org->>'name')
				  from (select distinct jsonb_build_object(
				          'slug', org_slug, 'name', org_name, 'name_np', org_name_np) as org
				          from live) t
			), '[]'::jsonb),
			'status_counts', coalesce((
				select jsonb_object_agg(display_status, n)
				  from (select display_status, count(*) as n from live group by 1) s
			), '{}'::jsonb)
		)`
	return d.JSON(ctx, q, p.Status, p.Type, p.District, p.Org, p.Query, p.Limit, p.Offset)
}
