-- Per-table fingerprint, for proving the VPS copy matches Supabase before the
-- Supabase data layer is torn down.
--
-- Run it on BOTH databases and compare the seven md5s. Counts alone do not
-- answer the question: the same number of rows can hold different values, and a
-- truncate-and-reload that silently dropped a column would still count right.
--
-- Media URLs are normalised to their object key, because the VPS copy rewrote
-- the host to the CDN on purpose. Without that, every image row would differ
-- and the check would be useless.
--
--   Supabase: run through the SQL editor or the MCP.
--   VPS:      docker exec -i <postgres container> psql -U postgres -d nilami -t -A -f -
--
-- property_view_stats is expected to drift: the counter moves whenever a page is
-- opened, and it is reloaded wholesale at cutover. Any OTHER table differing
-- means the copy is not faithful, and nothing should be dropped until it is.
with
o as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select id||':'||slug||':'||name||':'||name_np||':'||coalesce(website,'')||':'||contact_email||':'||contact_phone||':'||address||':'||address_np||':'||approved||':'||coalesce(regexp_replace(logo_url,'^.*/(organizations|properties)/','\1/'),'') t from organizations) x),
pr as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select id||':'||coalesce(full_name,'')||':'||email||':'||role||':'||coalesce(organization_id::text,'')||':'||approved t from profiles) x),
p as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select id||':'||slug||':'||title||':'||type||':'||province||':'||district||':'||municipality||':'||coalesce(ward::text,'')||':'||address||':'||coalesce(land_area_aana::text,'')||':'||coalesce(land_area_sqm::text,'')||':'||coalesce(building_floors::text,'')||':'||coalesce(built_year::text,'')||':'||coalesce(bedrooms::text,'')||':'||coalesce(bathrooms::text,'')||':'||coalesce(road_access,'')||':'||coalesce(facing,'')||':'||coalesce(latitude::text,'')||':'||coalesce(longitude::text,'')||':'||coalesce(video_url,'')||':'||description||':'||loan_ref||':'||is_published||':'||organization_id t from properties) x),
i as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select property_id||':'||regexp_replace(url,'^.*/(organizations|properties)/','\1/')||':'||alt||':'||sort_order t from property_images) x),
a as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select id||':'||property_id||':'||round||':'||notice_number||':'||coalesce(published_date::text,'')||':'||submission_deadline||':'||opening_datetime||':'||opening_venue||':'||coalesce(appraised_value::text,'')||':'||minimum_bid||':'||bid_security_amount||':'||coalesce(bid_security_pct::text,'')||':'||terms||':'||required_documents||':'||status||':'||coalesce(winning_amount::text,'')||':'||coalesce(result_note,'') t from auctions) x),
b as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select id||':'||auction_id||':'||full_name||':'||phone||':'||email||':'||citizenship_no||':'||coalesce(deposit_amount::text,'')||':'||coalesce(deposit_proof_url,'')||':'||deposit_status||':'||notes t from bidder_records) x),
v as (select md5(string_agg(t,'|' order by t)) h, count(*) n from (
  select property_id||':'||view_count t from property_view_stats) x)
select 'organizations '||o.n||' '||o.h||E'\n'||'profiles '||pr.n||' '||pr.h||E'\n'||'properties '||p.n||' '||p.h||E'\n'||'property_images '||i.n||' '||i.h||E'\n'||'auctions '||a.n||' '||a.h||E'\n'||'bidder_records '||b.n||' '||b.h||E'\n'||'property_view_stats '||v.n||' '||v.h
from o,pr,p,i,a,b,v;
