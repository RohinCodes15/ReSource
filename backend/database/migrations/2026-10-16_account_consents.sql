-- Existing Supabase projects: apply manually after the base schema, only after review.
-- New projects get the same table/policies from schema.sql and rls_policies.sql.
-- Account consent has no owner_hash or foreign key to reports, posts or votes.
begin;

create table if not exists public.account_consents (
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null check (btrim(policy_version) <> ''),
  accepted_at timestamptz not null default now(),
  primary key (user_id, policy_version)
);

alter table public.account_consents enable row level security;
revoke all on public.account_consents from public, anon, authenticated;
grant select on public.account_consents to authenticated;
grant insert (user_id, policy_version) on public.account_consents to authenticated;
grant all on public.account_consents to service_role;

drop policy if exists "Users read own account consent" on public.account_consents;
create policy "Users read own account consent" on public.account_consents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users accept own account policy" on public.account_consents;
create policy "Users accept own account policy" on public.account_consents
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- No authenticated UPDATE or DELETE grants/policies. accepted_at is server-generated.
commit;
