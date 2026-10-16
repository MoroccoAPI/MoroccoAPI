#!/usr/bin/env python3
"""Rebuild the ODbL Tensift dam snapshot from checksum-pinned ABHT XLSX files.

Python 3.10+; standard library only. Reads cached Excel numeric values and never
executes formulas, macros, external links or embedded workbook objects.
"""

import argparse
import calendar
from datetime import date, timedelta
import hashlib
import io
import json
import math
from pathlib import Path
import posixpath
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "dams"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
DAMS = [
    ("yacoub-el-mansour", "Yacoub El Mansour"),
    ("lalla-takerkoust", "Lalla Takerkoust"),
    ("sd-mohamed-ben-slimane-el-jazouli", "Sd Mohamed Ben Slimane El Jazouli"),
    ("abou-el-abess-sebti", "Abou El Abess Sebti"),
    ("bge-my-abdrhmane", "Bge My abdrhmane"),
]
EXPECTED_SHEETS = {"2026-08": "Août_2026", "2026-09": "Sept_2026"}
CATALOG_FIELDS = (
    "id", "name", "title", "notes", "license_id", "license_title", "license_url",
    "isopen", "metadata_created", "metadata_modified", "temporal_coverage_start",
    "temporal_coverage_end", "version", "collection_frequency", "resources",
)


def catalog_snapshot(raw):
    """Keep dataset/license/resource evidence; omit contributor contact metadata."""
    result = json.loads(raw)["result"]
    subset = {key: result[key] for key in CATALOG_FIELDS}
    subset["organization"] = {key: result["organization"][key] for key in ("id", "name", "title")}
    return (json.dumps({"result": subset}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def verified_bytes(resource, data_dir=DATA):
    path = data_dir / resource["raw_file"]
    raw = path.read_bytes()
    if len(raw) != resource["bytes"] or hashlib.sha256(raw).hexdigest() != resource["sha256"]:
        raise ValueError(f"Source checksum/size mismatch: {resource['raw_file']}")
    return raw


def read_sheet(raw, expected_sheet):
    """Read simple worksheet cells by explicit coordinates, including cached formulas."""
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ["".join(si.itertext()) for si in
                      ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("s:si", NS)]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        sheets = workbook.findall("s:sheets/s:sheet", NS)
        if len(sheets) != 1 or sheets[0].get("name") != expected_sheet:
            raise ValueError(f"Unexpected workbook sheets; expected only {expected_sheet}")
        sheet_id = sheets[0].get(f"{{{REL_NS}}}id")
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = [r for r in relationships if r.get("Id") == sheet_id]
        if len(targets) != 1 or targets[0].get("TargetMode") == "External":
            raise ValueError("Missing or external worksheet relationship")
        target = targets[0].get("Target", "")
        sheet_path = posixpath.normpath(posixpath.join("xl", target))
        if not sheet_path.startswith("xl/worksheets/"):
            raise ValueError(f"Unexpected worksheet path: {sheet_path}")
        worksheet = ET.fromstring(archive.read(sheet_path))
        cells = {}
        for cell in worksheet.findall("s:sheetData/s:row/s:c", NS):
            ref = cell.get("r", "")
            if not re.fullmatch(r"[A-Z]+[1-9]\d*", ref) or ref in cells:
                raise ValueError(f"Invalid/duplicate cell coordinate: {ref}")
            value = cell.find("s:v", NS)
            kind = cell.get("t")
            if kind == "inlineStr":
                inline = cell.find("s:is", NS)
                cells[ref] = "".join(inline.itertext()) if inline is not None else ""
            elif value is None or value.text is None:
                if cell.find("s:f", NS) is not None:
                    raise ValueError(f"Formula has no cached value: {ref}")
                cells[ref] = None
            elif kind == "s":
                cells[ref] = shared[int(value.text)]
            elif kind in (None, "n"):
                cells[ref] = float(value.text)
            else:
                raise ValueError(f"Unsupported cell type {kind}: {ref}")
        return cells


def numeric(value, ref, *, positive=False):
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"Missing or invalid numeric source value: {ref}")
    if value < 0 or (positive and value == 0):
        raise ValueError(f"Invalid negative/zero source value: {ref}")
    return value


def normalize_resource(resource, raw):
    period = resource["period"]
    if EXPECTED_SHEETS.get(period) != resource["sheet"]:
        raise ValueError("Unreviewed or ambiguous observation year/month")
    year, month = map(int, period.split("-"))
    days = calendar.monthrange(year, month)[1]
    cells = read_sheet(raw, resource["sheet"])
    if cells.get("A1") != "Bassin" or cells.get("A2") != "CAPACITÉ NORMALE\n(Mm³)" or cells.get("A3") != "JOUR":
        raise ValueError("Unexpected source header, capacity unit or day label")
    columns = [(chr(66 + 2 * index), chr(67 + 2 * index)) for index in range(len(DAMS))]
    for (_, name), (volume_col, filling_col) in zip(DAMS, columns):
        for col in (volume_col, filling_col):
            if str(cells.get(f"{col}1", "")).strip() != name:
                raise ValueError(f"Unexpected dam name: {col}1")
        if cells.get(f"{volume_col}3") != "RESERVE (Mm3)" or cells.get(f"{filling_col}3") != "TAUX DE REMPLISSAGE\n ( % )":
            raise ValueError("Unexpected reserve or filling-rate source unit")
        capacity = numeric(cells.get(f"{volume_col}2"), f"{volume_col}2", positive=True)
        if cells.get(f"{filling_col}2") != capacity:
            raise ValueError("Source capacity pair disagrees")
    # Ignore formatting-only cells, but never silently discard new source values.
    for ref, value in cells.items():
        if value is not None:
            col, row = re.fullmatch(r"([A-Z]+)(\d+)", ref).groups()
            if col not in "ABCDEFGHIJK" or len(col) != 1 or int(row) > days + 3:
                raise ValueError(f"Unexpected nonempty cell outside reviewed table: {ref}")
    result = []
    seen_days = set()
    for row in range(4, days + 4):
        day = numeric(cells.get(f"A{row}"), f"A{row}", positive=True)
        if not day.is_integer() or day != row - 3 or day in seen_days:
            raise ValueError(f"Missing/duplicate/out-of-order source day: A{row}")
        seen_days.add(day)
        observed_date = date(year, month, int(day)).isoformat()
        for (dam_id, _), (volume_col, filling_col) in zip(DAMS, columns):
            volume = numeric(cells.get(f"{volume_col}{row}"), f"{volume_col}{row}")
            filling = numeric(cells.get(f"{filling_col}{row}"), f"{filling_col}{row}")
            capacity = numeric(cells.get(f"{volume_col}2"), f"{volume_col}2", positive=True)
            if filling > 100 or not math.isclose(filling, volume / capacity * 100, rel_tol=0, abs_tol=1e-8):
                raise ValueError(f"Source reserve/capacity/filling inconsistency: {volume_col}{row}")
            result.append({
                "dam_id": dam_id,
                "date": observed_date,
                "volume_mm3": volume,
                "filling_rate_pct": filling,
                "capacity_mm3": capacity,
                "source_id": resource["id"],
                "source_ref": {"sheet": resource["sheet"], "row": row},
            })
    if len(result) != resource["observation_count"]:
        raise ValueError("Resource observation count disagrees with reviewed manifest")
    return result


def build(data_dir=DATA):
    manifest = json.loads((data_dir / "sources.json").read_text(encoding="utf-8"))
    if manifest["source_license"] != "ODbL-1.0":
        raise ValueError("Only the reviewed ODbL-1.0 source is supported")
    metadata = json.loads(verified_bytes(manifest["metadata_snapshot"], data_dir))["result"]
    if metadata["license_id"] != "odc-odbl" or metadata["isopen"] is not True:
        raise ValueError("Raw official catalog lacks the reviewed open license")
    if metadata["temporal_coverage_start"] != manifest["coverage"]["start"] or metadata["temporal_coverage_end"] != manifest["coverage"]["end"]:
        raise ValueError("Official catalog temporal coverage disagrees")
    catalog_resources = {r["id"]: r for r in metadata["resources"]}
    levels = []
    source_ids = set()
    for resource in manifest["resources"]:
        if resource["id"] in source_ids:
            raise ValueError("Duplicate resource source ID")
        source_ids.add(resource["id"])
        catalog = catalog_resources[resource["resource_id"]]
        if catalog["url"] != resource["resource_url"] or catalog["name"] != resource["name"]:
            raise ValueError("Resource identity disagrees with raw official catalog")
        levels.extend(normalize_resource(resource, verified_bytes(resource, data_dir)))
    levels.sort(key=lambda r: (r["dam_id"], r["date"]))
    keys = {(r["dam_id"], r["date"]) for r in levels}
    first = date.fromisoformat(manifest["coverage"]["start"])
    last = date.fromisoformat(manifest["coverage"]["end"])
    expected = {(dam_id, (first + timedelta(days=offset)).isoformat())
                for dam_id, _ in DAMS for offset in range((last - first).days + 1)}
    if len(keys) != len(levels) or keys != expected:
        raise ValueError("Duplicate observation or incomplete dam/day coverage")
    if len(levels) != manifest["coverage"]["observation_count"]:
        raise ValueError("Total observation count disagrees with reviewed manifest")
    dams = [{"id": dam_id, "name": {"fr": name}, "basin": "tensift"} for dam_id, name in DAMS]
    dams.sort(key=lambda r: r["id"])
    return {"dams.json": dams, "levels.json": levels}


def download(manifest):
    # Check every response before replacing any local source file. Mutable URLs
    # must not silently turn this historical snapshot into a different release.
    downloaded = []
    for resource in [manifest["metadata_snapshot"], *manifest["resources"]]:
        request = urllib.request.Request(resource["resource_url"], headers={"User-Agent": "MoroccoAPI dam snapshot verification"})
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read()
        if resource is manifest["metadata_snapshot"]:
            raw = catalog_snapshot(raw)
        if len(raw) != resource["bytes"] or hashlib.sha256(raw).hexdigest() != resource["sha256"]:
            raise ValueError(f"Downloaded source changed; review before updating: {resource['raw_file']}")
        downloaded.append((DATA / resource["raw_file"], raw))
    for path, raw in downloaded:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify source hashes and compare rebuilt JSON without writing")
    parser.add_argument("--download", action="store_true", help="retrieve only pinned source bytes; reject upstream changes")
    args = parser.parse_args()
    if args.check and args.download:
        parser.error("--check is read-only and cannot be combined with --download")
    if args.download:
        download(json.loads((DATA / "sources.json").read_text(encoding="utf-8")))
    for name, rows in build().items():
        content = json.dumps(rows, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
        path = DATA / name
        if args.check:
            if path.read_text(encoding="utf-8") != content:
                raise ValueError(f"Generated output differs: {name}")
        else:
            path.write_text(content, encoding="utf-8", newline="\n")
        print(f"{name}: {len(rows)} records {'verified' if args.check else 'written'}")


if __name__ == "__main__":
    main()
