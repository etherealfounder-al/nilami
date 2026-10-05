-- The Nilami schema, ported off Supabase.
--
-- Three things changed in the move, each deliberate:
--
--  1. No row level security. The API is the only client and reaches the
--     database over a private network, so authorisation lives in one place —
--     the Scope carried by every query — instead of being split between
--     policies and application code, where the two drifted apart.
--  2. profiles.id no longer references auth.users. Identity stays with
--     Supabase; this database only records what an account is allowed to do.
--     Rows are created by the API on first authenticated request.
--  3. Indexes, which the hosted database never had. Every query below was
--     written against them.

create extension if not exists pgcrypto;

do $$ begin
  create type property_type as enum ('land', 'house', 'apartment', 'commercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type auction_status as enum ('draft', 'upcoming', 'open', 'closed', 'sold', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deposit_status as enum ('pending', 'verified', 'rejected', 'refunded');
exception when duplicate_object then null; end $$;

create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  name_np       text not null default '',
  logo_url      text,
  website       text,
  contact_email text not null default '',
  contact_phone text not null default '',
  address       text not null default '',
  address_np    text not null default '',
  approved      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- An account's standing. id is the Supabase user id, with no foreign key:
-- the identity provider owns that table, this one owns the permissions.
-- organization_id null means the platform administrator.
create table if not exists profiles (
  id              uuid primary key,
  full_name       text not null default '',
  email           text not null default '',
  role            text not null default 'officer',
  organization_id uuid references organizations (id) on delete set null,
  approved        boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists properties (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  type            property_type not null,
  province        text not null,
  district        text not null,
  municipality    text not null,
  ward            smallint,
  address         text not null default '',
  land_area_aana  numeric,
  land_area_sqm   numeric,
  building_floors smallint,
  built_year      smallint,
  bedrooms        smallint,
  bathrooms       smallint,
  road_access     text,
  facing          text,
  latitude        numeric,
  longitude       numeric,
  video_url       text,
  description     text not null default '',
  loan_ref        text not null default '',
  is_published    boolean not null default false,
  organization_id uuid not null references organizations (id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists property_images (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  url         text not null,
  alt         text not null default '',
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists auctions (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references properties (id) on delete cascade,
  round               smallint not null default 1,
  notice_number       text not null default '',
  published_date      date,
  submission_deadline timestamptz not null,
  opening_datetime    timestamptz not null,
  opening_venue       text not null default '',
  appraised_value     numeric,
  minimum_bid         numeric not null,
  bid_security_amount numeric not null,
  bid_security_pct    numeric,
  terms               text not null default '',
  required_documents  text not null default '',
  notice_pdf_url      text,
  status              auction_status not null default 'draft',
  winning_amount      numeric,
  result_note         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (property_id, round)
);

create table if not exists bidder_records (
  id                uuid primary key default gen_random_uuid(),
  auction_id        uuid not null references auctions (id) on delete cascade,
  full_name         text not null,
  phone             text not null default '',
  email             text not null default '',
  citizenship_no    text not null default '',
  deposit_amount    numeric,
  deposit_proof_url text,
  deposit_status    deposit_status not null default 'pending',
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Counters live apart from the listing so recording a view never touches the
-- properties row, whose updated_at trigger would otherwise fire on every visit
-- and contend with an editor saving the same record.
create table if not exists property_view_stats (
  property_id    uuid primary key references properties (id) on delete cascade,
  view_count     bigint not null default 0,
  last_viewed_at timestamptz
);

create index if not exists properties_organization_idx on properties (organization_id);
create index if not exists properties_published_idx    on properties (is_published) where is_published;
create index if not exists properties_district_idx     on properties (district);
create index if not exists auctions_status_idx         on auctions (status);
create index if not exists auctions_deadline_idx       on auctions (submission_deadline);
create index if not exists property_images_prop_idx    on property_images (property_id, sort_order);
create index if not exists bidder_records_auction_idx  on bidder_records (auction_id);
create index if not exists profiles_organization_idx   on profiles (organization_id);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  create trigger properties_updated_at before update on properties
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger auctions_updated_at before update on auctions
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger bidder_records_updated_at before update on bidder_records
    for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
