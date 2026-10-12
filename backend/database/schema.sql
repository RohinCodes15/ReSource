-- ReSource / Supabase schema. Run this before seed.sql in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('library', 'transit', 'recreation', 'health', 'education')),
  status text not null default 'open' check (status in ('open', 'reduced', 'closed')),
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  description text not null default '',
  cut_amount integer not null default 0 check (cut_amount >= 0),
  effective_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  address text not null,
  phone text not null default '',
  website text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  description text not null default '',
  languages text[] not null default array['English']::text[]
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  address text not null default '',
  description text not null,
  impact_level text not null check (impact_level in ('low', 'medium', 'high')),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  service_id uuid references public.services(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  upvotes integer not null default 0 check (upvotes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists services_status_idx on public.services(status);
create index if not exists services_category_idx on public.services(category);
create index if not exists resources_category_idx on public.resources(category);
create index if not exists alerts_created_at_idx on public.alerts(created_at desc);
create index if not exists reports_created_at_idx on public.reports(created_at desc);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

-- Public catalog data is readable by the app's anon key. Reports remain private;
-- the FastAPI server accesses them with SUPABASE_SERVICE_ROLE_KEY.
alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.reports enable row level security;
alter table public.alerts enable row level security;
alter table public.posts enable row level security;

drop policy if exists "Public can read services" on public.services;
create policy "Public can read services" on public.services for select to anon, authenticated using (true);
drop policy if exists "Public can read resources" on public.resources;
create policy "Public can read resources" on public.resources for select to anon, authenticated using (true);
drop policy if exists "Public can read alerts" on public.alerts;
create policy "Public can read alerts" on public.alerts for select to anon, authenticated using (true);
drop policy if exists "Public can read posts" on public.posts;
create policy "Public can read posts" on public.posts for select to anon, authenticated using (true);

grant select on public.services, public.resources, public.alerts, public.posts to anon, authenticated;
grant select, insert, update, delete on public.services, public.resources, public.reports,
  public.alerts, public.posts to service_role;
