-- ReSource / Supabase schema.
-- Run in the Supabase SQL editor in this order: schema.sql, rls_policies.sql, seed.sql.
-- Safe to run again: every statement is "if not exists".
--
-- Data-minimization notes, enforced by what columns exist:
--   * No names, no IP addresses, no device identifiers, no coordinates of people.
--   * `owner_hash` is HMAC(server secret, random install token). It lets someone delete their
--     own rows; it cannot be turned back into a device or a person.
--   * Email appears in two places only, both opt-in: email_subscriptions and deletion_requests.
create extension if not exists pgcrypto;

-- ---- Catalog: public information with a source on every row --------------------------------
create table if not exists public.services (
  id text primary key,
  name text not null,
  category text not null,
  status text not null default 'open' check (status in ('open', 'reduced', 'closed')),
  area text not null default 'citywide',
  address text not null default '',
  location_note text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  coords text,
  phone text,
  hours text,
  summary text not null default '',
  detail text,
  cut_amount bigint check (cut_amount is null or cut_amount >= 0),
  cut_amount_note text,
  effective_date date,
  updated_at date,
  action_label text,
  action_url text,
  alt_categories text[] not null default '{}',
  source_title text,
  source_url text,
  retrieved date,
  verified boolean not null default false
);

create table if not exists public.resources (
  id text primary key,
  name text not null,
  category text not null,
  area text not null default 'citywide',
  address text not null default '',
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  coords text,
  phone text not null default '',
  website text not null default '',
  hours text,
  description text not null default '',
  languages text[] not null default '{}',
  language_note text,
  source_url text,
  retrieved date,
  verified boolean not null default false
);

create table if not exists public.alerts (
  id text primary key,
  title text not null,
  body text not null,
  category text not null check (category in ('budget', 'public_safety', 'human_services', 'infrastructure', 'civic')),
  area text not null default 'citywide',
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  published_at date not null,
  service_id text references public.services(id) on delete set null,
  source_title text,
  source_url text,
  retrieved date,
  verified boolean not null default false
);

-- ---- Written by residents, always through the API ------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  service_id text references public.services(id) on delete set null,
  service_name text not null check (char_length(service_name) <= 160),
  area text not null default 'citywide',
  description text not null check (char_length(description) <= 1000),
  impact_level text not null check (impact_level in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  photo_path text,
  owner_hash text not null,
  policy_version text not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id text primary key default gen_random_uuid()::text,
  body text not null check (char_length(body) <= 280),
  area text not null default 'citywide',
  upvotes integer not null default 0 check (upvotes >= 0),
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  is_sample boolean not null default false,
  owner_hash text,
  policy_version text,
  created_at timestamptz not null default now()
);

-- One vote and one abuse flag per person per post, enforced by the database as well as the API.
create table if not exists public.post_votes (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts(id) on delete cascade,
  owner_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, owner_hash)
);

create table if not exists public.post_flags (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts(id) on delete cascade,
  owner_hash text not null,
  created_at timestamptz not null default now(),
  unique (post_id, owner_hash)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_hash text not null unique,
  categories text[] not null default '{}',
  areas text[] not null default '{}',
  notifications boolean not null default false,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  categories text[] not null default '{}',
  areas text[] not null default '{}',
  owner_hash text,
  policy_version text not null,
  created_at timestamptz not null default now()
);

-- What was agreed to, which policy version, when. Nothing else.
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  owner_hash text not null,
  kind text not null check (kind in ('report', 'post', 'email_alerts')),
  policy_version text not null,
  created_at timestamptz not null default now()
);

-- Account consent is separate from install-owned reports, posts, votes and consent_records.
create table if not exists public.account_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check (btrim(policy_version) <> ''),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version)
);
alter table public.account_consents enable row level security;
revoke all on public.account_consents from public, anon, authenticated;

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  contact_email text,           -- cleared when the request is completed
  details text not null,
  relationship text not null default 'self' check (relationship in ('self', 'parent_or_guardian')),
  status text not null default 'open' check (status in ('open', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('problem', 'idea', 'data_error')),
  message text not null check (char_length(message) <= 1000),
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists services_status_idx on public.services(status);
create index if not exists services_category_idx on public.services(category);
create index if not exists resources_category_idx on public.resources(category);
create index if not exists alerts_published_idx on public.alerts(published_at desc);
create index if not exists reports_status_idx on public.reports(status, created_at desc);
create index if not exists reports_owner_idx on public.reports(owner_hash);
create index if not exists posts_status_idx on public.posts(status, created_at desc);
create index if not exists posts_owner_idx on public.posts(owner_hash);
create index if not exists post_votes_owner_idx on public.post_votes(owner_hash);
create index if not exists consent_owner_idx on public.consent_records(owner_hash);

-- Private bucket for the optional photo on a report. Nothing in it is publicly readable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
