# Admin screen: Google sign-in for admins, report status filter, confirmations

> **Base branch:** `main`. PR #3 (`fix-round` → `main`) has merged and this branch was rebased
> onto `main`, so the diff shows only the admin commits.

## What changes

- **Google sign-in opens the admin tools for admins.** A signed-in account whose
  `app_metadata.role` is `"admin"` gets the admin screen without the passcode. A signed-in
  non-admin sees "this account is not an admin" above the passcode form.
- **The passcode still works** exactly as before (`ADMIN_TOKEN` on the API).
- **Reports tab:** a Waiting / Verified / Rejected filter. Each report shows the actions that fit
  its status: Verify, Reject, Move back to waiting. Reject and Move back to waiting ask for
  confirmation first.
- **Sign-in screen:** an "Open admin tools" button for admins.
- **Strings** in all five languages (en, es, fa, vi, zh).

## Security

- The app only decides what to draw. The API re-checks admin on every request (passcode, or a
  Supabase token whose user has `app_metadata.role = "admin"`) and answers 403 otherwise.
- The role is read from `app_metadata` only, never `user_metadata`, which users can edit.
- Photos still load through the API's admin-only route; no signed URLs or new storage access.
- No changes to `backend/` or `backend/database/`, and no SQL schema or RLS changes.
- `docs/handoff/test_admin_role.py`: a backend test showing no-role and `user` accounts get 403
  from the report list, the status change and the photo route, while `admin` gets through.
  It passes against the current backend; Codex will move it into `backend/tests/`.

## One-time setup: grant the admin role

Do this once per admin, **after** that person has signed in with Google at least once. Only grant
it to people who should see residents' reports and photos.

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'admin@example.com';
```

The SQL editor must report **1 row** updated. 0 rows means the email does not match the one Google
gave Supabase. The person then signs out and back in so their session carries the role.

To remove it: `update auth.users set raw_app_meta_data = raw_app_meta_data - 'role' where email = 'admin@example.com';`

## Testing

- `npm run check` in `app/`: types, lint, accessibility, storage and claims checks, 17 tests pass.
- Backend role test: 3 of 3 pass.
- Manual browser checklist: `docs/handoff/ADMIN_BROWSER_TEST.md`.
