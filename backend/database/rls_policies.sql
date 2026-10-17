-- ReSource row-level security. Run after schema.sql. Safe to run again.
--
-- The model in one paragraph: the FastAPI server holds the service-role key, which bypasses
-- RLS, and it is the ONLY writer for resident data. It validates, rate-limits, scrubs personal
-- details and moderates before anything is stored. The public anon key, which ships inside the
-- app and must be treated as public, can read the public catalog and approved posts and can do
-- nothing else. A signed-in admin (app_metadata.role = 'admin', set by hand in the Supabase
-- dashboard) may additionally moderate and update service status.
-- Account consent is a separate exception: authenticated users may insert/read only their own
-- consent rows. They cannot supply the server timestamp or update/delete the audit record.
--
-- With RLS enabled and no policy, a table is closed to anon and authenticated. Every "no policy"
-- below is a deliberate default-deny.

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.services enable row level security;
alter table public.resources enable row level security;
alter table public.alerts enable row level security;
alter table public.reports enable row level security;
alter table public.posts enable row level security;
alter table public.post_votes enable row level security;
alter table public.post_flags enable row level security;
alter table public.subscriptions enable row level security;
alter table public.email_subscriptions enable row level security;
alter table public.consent_records enable row level security;
alter table public.account_consents enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.feedback enable row level security;

-- Start from nothing, then grant exactly what each role needs.
revoke all on all tables in schema public from anon, authenticated;

-- ---- services, resources, alerts: public information ---------------------------------------
-- Anyone may read. Nobody but an admin may change a row (status updates are admin-only).
grant select on public.services, public.resources, public.alerts to anon, authenticated;
grant update on public.services to authenticated;

drop policy if exists "Anyone can read services" on public.services;
create policy "Anyone can read services" on public.services for select to anon, authenticated using (true);
drop policy if exists "Admins update services" on public.services;
create policy "Admins update services" on public.services for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can read resources" on public.resources;
create policy "Anyone can read resources" on public.resources for select to anon, authenticated using (true);

drop policy if exists "Anyone can read alerts" on public.alerts;
create policy "Anyone can read alerts" on public.alerts for select to anon, authenticated using (true);

-- ---- posts: approved posts are public, minus the columns that identify the author ----------
-- Column-level grant: owner_hash and policy_version are never readable with the anon key.
-- Inserts, votes, flags and deletes go through the API so its rate limit, consent check,
-- profanity hold and PII scrub cannot be skipped.
grant select (id, body, area, upvotes, status, is_sample, created_at) on public.posts to anon, authenticated;
grant update (status) on public.posts to authenticated;

drop policy if exists "Anyone can read approved posts" on public.posts;
create policy "Anyone can read approved posts" on public.posts for select to anon, authenticated
  using (status = 'approved' or public.is_admin());
drop policy if exists "Admins moderate posts" on public.posts;
create policy "Admins moderate posts" on public.posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- reports: private until an admin verifies them, and never public row by row -------------
-- Residents file reports anonymously through the API (rate-limited per caller). No anon or
-- ordinary authenticated access at all. Admins may read and set the status; the public only
-- ever sees aggregate counts that the API computes from verified rows.
grant select on public.reports to authenticated;
grant update (status, reviewed_at) on public.reports to authenticated;

drop policy if exists "Admins read reports" on public.reports;
create policy "Admins read reports" on public.reports for select to authenticated using (public.is_admin());
drop policy if exists "Admins verify reports" on public.reports;
create policy "Admins verify reports" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- post_votes, post_flags, subscriptions, email_subscriptions, consent_records -----------
-- Keyed by owner_hash, which only the server can compute. No policies: server only.

-- ---- account_consents: account-only consent, never joined to resident contributions --------
revoke all on public.account_consents from public, anon, authenticated;
grant select on public.account_consents to authenticated;
grant insert (user_id, policy_version) on public.account_consents to authenticated;

drop policy if exists "Users read own account consent" on public.account_consents;
create policy "Users read own account consent" on public.account_consents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users accept own account policy" on public.account_consents;
create policy "Users accept own account policy" on public.account_consents
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---- deletion_requests, feedback ------------------------------------------------------------
-- Written through the API. Admins may read them to act on them.
grant select on public.deletion_requests, public.feedback to authenticated;
grant update (status, contact_email, completed_at) on public.deletion_requests to authenticated;

drop policy if exists "Admins read deletion requests" on public.deletion_requests;
create policy "Admins read deletion requests" on public.deletion_requests for select to authenticated using (public.is_admin());
drop policy if exists "Admins close deletion requests" on public.deletion_requests;
create policy "Admins close deletion requests" on public.deletion_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins read feedback" on public.feedback;
create policy "Admins read feedback" on public.feedback for select to authenticated using (public.is_admin());

-- ---- Storage: report photos -----------------------------------------------------------------
-- The bucket is private. Uploads come from the API after it re-encodes the image (which strips
-- location metadata). Only an admin may view a photo, to moderate the report it belongs to.
drop policy if exists "Admins read report photos" on storage.objects;
create policy "Admins read report photos" on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and public.is_admin());

-- The server role keeps full access (it bypasses RLS; the grant is for clarity).
grant all on all tables in schema public to service_role;
