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
			), '[]'::jsonb)
		)
		  from live`
	return d.JSON(ctx, q)
}
