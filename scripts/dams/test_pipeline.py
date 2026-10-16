"""Malformed source checks use modified XLSX XML, leaving official files intact."""

import io
import json
import unittest
import xml.etree.ElementTree as ET
import zipfile

import pipeline


class DamPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        manifest = json.loads((pipeline.DATA / "sources.json").read_text(encoding="utf-8"))
        cls.resource = manifest["resources"][0]
        cls.raw = pipeline.verified_bytes(cls.resource)

    def altered(self, ref, value):
        """Change one cached cell in a disposable in-memory source archive."""
        target = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(self.raw)) as source, zipfile.ZipFile(target, "w") as output:
            for entry in source.infolist():
                raw = source.read(entry.filename)
                if entry.filename == "xl/worksheets/sheet1.xml":
                    sheet = ET.fromstring(raw)
                    cell = sheet.find(f".//s:c[@r='{ref}']", pipeline.NS)
                    cached = cell.find("s:v", pipeline.NS)
                    if value is None:
                        cell.remove(cached)
                    else:
                        cached.text = value
                    raw = ET.tostring(sheet)
                output.writestr(entry, raw)
        return target.getvalue()

    def test_reviewed_source_complete_and_preserves_cached_percentage(self):
        rows = pipeline.normalize_resource(self.resource, self.raw)
        self.assertEqual(len(rows), 155)
        first = rows[0]
        self.assertEqual(first["date"], "2026-08-01")
        self.assertEqual(first["volume_mm3"], 49.205)
        self.assertEqual(first["filling_rate_pct"], 85.64838990426456)
        self.assertEqual(first["source_ref"], {"sheet": "Août_2026", "row": 4})

    def test_missing_or_repeated_day_rejected(self):
        for value in (None, "1"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                pipeline.normalize_resource(self.resource, self.altered("A5", value))

    def test_missing_measurement_not_coerced_to_zero(self):
        with self.assertRaises(ValueError):
            pipeline.normalize_resource(self.resource, self.altered("B4", None))

    def test_nonfinite_volume_and_inconsistent_percentage_rejected(self):
        for ref, value in (("B4", "NaN"), ("C4", "0")):
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                pipeline.normalize_resource(self.resource, self.altered(ref, value))

    def test_unreviewed_year_cannot_relabel_observations(self):
        with self.assertRaises(ValueError):
            pipeline.normalize_resource({**self.resource, "period": "2027-08"}, self.raw)

    def test_cached_formula_required(self):
        with self.assertRaises(ValueError):
            pipeline.normalize_resource(self.resource, self.altered("C4", None))


if __name__ == "__main__":
    unittest.main()
