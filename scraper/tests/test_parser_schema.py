"""The parser must emit columns accepted by the current services schema."""
import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from parse_budget import to_supabase_rows


class ParserSchemaTests(unittest.TestCase):
    def test_rows_use_summary_not_legacy_description(self):
        frame = pd.DataFrame([{
            "service": "Niles Library", "department": "Library", "evidence": "Library reduced",
            "status": "reduced", "original_budget": 20000, "new_budget": 15000,
            "source": "budget.pdf", "cut_amount": 5000, "effective_date": "2026-01-01",
        }])
        rows, skipped = to_supabase_rows(frame)
        self.assertEqual(skipped, 0)
        self.assertNotIn("description", rows[0])
        self.assertIn("verify against the source document", rows[0]["summary"])
        self.assertEqual(rows[0]["cut_amount"], 5000)


if __name__ == "__main__":
    unittest.main()
