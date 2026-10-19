"""Static integrity checks for the shared catalog before it is seeded or shipped."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validate_catalog import load_catalogs, validate_catalogs


class CatalogDataTests(unittest.TestCase):
    def test_shared_catalog_meets_size_provenance_and_enum_requirements(self):
        services, resources = load_catalogs()
        self.assertEqual(validate_catalogs(services, resources), [])

    def test_phone_only_and_po_box_resources_have_no_map_coordinates(self):
        _, resources = load_catalogs()
        for row in resources:
            address = row["address"].lower()
            if address == "phone and online service" or "po box" in address or "p.o. box" in address:
                with self.subTest(resource=row["id"]):
                    self.assertIsNone(row["lat"])
                    self.assertIsNone(row["lng"])
                    self.assertIsNone(row["coords"])


if __name__ == "__main__":
    unittest.main()
