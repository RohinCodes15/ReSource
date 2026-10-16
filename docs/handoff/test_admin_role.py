"""Scratch check (not committed): a signed-in non-admin gets 403 from report moderation and photos."""
import pytest
from tests.conftest import ALICE  # noqa: F401  (fixtures come from -p tests.conftest)
from tests.test_api import report_body


@pytest.mark.parametrize("role, expected_ok", [(None, False), ("user", False), ("admin", True)])
def test_role_gates_moderation_and_photo(client, monkeypatch, role, expected_ok):
    import security

    report = client.post("/reports", json=report_body(), headers=ALICE).json()
    monkeypatch.setattr(security, "signed_in_user", lambda request: {"id": "u1", "role": role})
    auth = {"Authorization": "Bearer signed-in-token"}
    listing = client.get("/admin/reports?status=all", headers=auth)
    moderate = client.post(f"/admin/reports/{report['id']}", json={"status": "rejected"}, headers=auth)
    photo = client.get(f"/admin/reports/{report['id']}/photo", headers=auth)
    if expected_ok:
        assert listing.status_code == 200 and moderate.status_code == 200
        assert photo.status_code == 404  # passed the admin check; this report simply has no photo
    else:
        assert (listing.status_code, moderate.status_code, photo.status_code) == (403, 403, 403)
