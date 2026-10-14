"""S8: free-text service labels and every CSV column must be safe."""
import csv
import io

import pytest
from conftest import ADMIN, ALICE, report_body

from routers.admin import safe_csv_cell
from store import get_store


def test_service_name_is_scrubbed_and_aggregated_as_other(client):
    name = '=HYPERLINK("https://example.test","Jane 510-555-0100 pat@example.test")'
    response = client.post("/reports", headers=ALICE, json=report_body(service_id=None, service_name=name))
    assert response.status_code == 201
    row = response.json()
    assert "510-555-0100" not in row["service_name"] and "pat@example.test" not in row["service_name"]
    assert set(row["pii_removed"]) == {"phone", "email"}
    client.post(f"/admin/reports/{row['id']}", headers=ADMIN, json={"status": "verified"})
    groups = client.get("/impact/summary").json()["by_service"]
    assert groups[0]["key"] == "Other"
    assert "Jane" not in str(groups)
    records = list(csv.reader(io.StringIO(client.get("/impact/export.csv", headers=ADMIN).text)))
    assert records[1][2].startswith("'=HYPERLINK")


@pytest.mark.parametrize("value", ["=1+1", "+1", "-1", "@SUM(A1)", "  =1", "\t=1", "\r=1", "\n=1", "  \tplain"])
def test_csv_dangerous_prefixes_are_escaped(value):
    assert safe_csv_cell(value) == "'" + value


def test_every_exported_column_is_escaped_for_legacy_rows(client):
    get_store().insert("reports", {"id": "=id", "created_at": "\tdate", "service_name": "+service",
                                  "area": " @area", "impact_level": "-impact", "description": "\r=description",
                                  "status": "verified"})
    rows = list(csv.reader(io.StringIO(client.get("/impact/export.csv", headers=ADMIN).text)))
    assert all(cell.startswith("'") for cell in rows[1])


def test_scrubbing_does_not_exceed_database_length_limits(client):
    name = "5105550100 " * 14
    response = client.post("/reports", headers=ALICE, json=report_body(service_id=None, service_name=name))
    assert response.status_code == 201
    assert len(response.json()["service_name"]) <= 160
