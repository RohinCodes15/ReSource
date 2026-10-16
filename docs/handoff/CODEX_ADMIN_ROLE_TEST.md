# Handoff to Codex: admin-role regression test

The app now opens the admin screen for a Google-signed-in account whose `app_metadata.role` is
`admin` (branch `admin-google-signin`). The app only decides what to draw; the API is the real gate.

`test_admin_role.py` (next to this note) checks that gate: a signed-in user with no role or role
`user` gets 403 from `GET /admin/reports`, `POST /admin/reports/{id}` and
`GET /admin/reports/{id}/photo`, and role `admin` gets through. It passed (3 of 3) against the
current backend.

Please move it into `backend/tests/` (it fits in `test_api.py` next to
`test_admin_routes_need_the_token`), drop the `tests.` prefix from its imports, and delete this
folder. No SQL or backend code change is needed.

Run it where it is, from `backend/`:

    PYTHONPATH=.:tests .venv/bin/python -m pytest -q -p tests.conftest ../docs/handoff/test_admin_role.py
