import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { loadLabourData, loadLabourMappings, loadLabourRows } from "../../src/population/labour/data/labour.js";
import {
  assertLabourMappings, buildLabourSnapshot,
  type LabourMappings, type LabourRows,
} from "../../src/population/labour/data/transform.js";
import { buildLabourDatasetMeta } from "../../src/population/labour/metadata.js";
import { LABOUR_FIELDS, type LabourData, type LabourObservation } from "../../src/population/labour/types.js";

let geography: GeographySnapshot;
let data: LabourData;
let rows: LabourRows;
let mappings: LabourMappings;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const mutable = (source: LabourRows = rows) => copy(source) as Record<keyof LabourRows, (string | number | null)[][]>;
const build = (source: LabourRows = rows, map: LabourMappings = mappings) => buildLabourSnapshot(source, map, geography);
const find = (code: string, area: string, year: number) =>
  data.observations.find((item) => item.code === code && item.area === area && item.year === year);
const rowIndex = (field: keyof LabourRows, area: string, name: string) =>
  rows[field].findIndex((row) => row[0] === area && row[1] === name);

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  mappings = await loadLabourMappings();
  [rows, data] = await Promise.all([loadLabourRows(mappings), loadLabourData(geography)]);
});

describe("population/labour data", () => {
  it("publishes 74 provinces and prefectures over nine survey years", () => {
    assert.deepEqual(data.years, [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    assert.equal(data.observations.length, 1898);
    const count = (area: string) => data.observations.filter((item) => item.area === area).length;
    assert.deepEqual([count("all"), count("urban"), count("rural")], [664, 648, 586]);
    const codes = new Set(data.observations.map((item) => item.code));
    assert.equal(codes.size, 74);
    assert.deepEqual(geography.provinces.filter((province) => !codes.has(province.code)).map((province) => province.code), ["aousserd"]);
  });

  it("matches the checksums and coverage recorded in the source manifest", async () => {
    const manifest = await readFile(new URL("../../sources/population/labour-market.yml", import.meta.url), "utf8");
    const files = [...manifest.matchAll(/- file: (\S+)\n\s+sha256: ([0-9a-f]{64})/g)];
    assert.deepEqual(files.map((match) => match[1]), [
      "data/population/source/labour-activity-rate.json", "data/population/source/labour-employment-rate.json",
      "data/population/source/labour-unemployment-rate.json", "data/population/labour-mappings.json",
    ]);
    for (const [, path, expected] of files) {
      const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
    }
    const coverage = (key: string) => Number(manifest.match(new RegExp(`\\n  ${key}: (\\d+)\\n`))?.[1]);
    const values = (field: (typeof LABOUR_FIELDS)[number]) => data.observations.filter((item) => item[field] !== null).length;
    assert.equal(coverage("first_year"), data.years[0]);
    assert.equal(coverage("last_year"), data.years.at(-1));
    assert.equal(coverage("years"), data.years.length);
    assert.equal(coverage("provinces"), new Set(data.observations.map((item) => item.code)).size);
    assert.equal(coverage("unpublished_provinces"), mappings.unpublished_provinces.entries.length);
    assert.equal(coverage("observations"), data.observations.length);
    for (const area of ["all", "urban", "rural"]) {
      assert.equal(coverage(`${area === "all" ? "all_area" : area}_observations`), data.observations.filter((item) => item.area === area).length, area);
    }
    for (const field of LABOUR_FIELDS) assert.equal(coverage(`${field}_values`), values(field), field);
    assert.deepEqual([...manifest.matchAll(/\n    source_rows: (\d+)\n/g)].map((match) => Number(match[1])),
      LABOUR_FIELDS.map((field) => rows[field].length));
    const meta = buildLabourDatasetMeta(0);
    assert.match(manifest, new RegExp(`\\nretrieved_at: ${meta.retrieved_at}\\n`));
    assert.match(manifest, new RegExp(`\\nversion: ${meta.transformation_version}\\n`));
    for (const source of meta.sources) {
      assert.ok(manifest.includes(`\n    resource_url: ${source.resource_url}\n`), source.resource_url);
      assert.ok(manifest.includes(`\n    catalog_url: ${source.source_url}\n`), source.source_url);
      assert.ok(manifest.includes(`\n    dataset: ${source.dataset}\n`), source.dataset);
      assert.ok(manifest.includes(`\n    source_updated_at: ${source.source_updated_at}\n`), source.source_updated_at);
    }
  });

  it("keeps the source sheets verbatim, newest year first", () => {
    assert.deepEqual(LABOUR_FIELDS.map((field) => rows[field].length), [214, 214, 181]);
    assert.ok(LABOUR_FIELDS.every((field) => rows[field].every((row) => row.length === 11)));
    assert.equal(rows.unemployment_rate[0]![0], "Taux de chômage selon les Provinces/Préfectures et le Milieu (POURCENTAGE)");
    assert.deepEqual(rows.activity_rate[1], ["Milieu", "Provinces/Préfectures", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017"]);
    assert.deepEqual(rows.activity_rate[2], ["National", "Al Hoceima", 48.1, 49.1, 49.9, 52.5, 50.5, 45.4, 48.2, 52.3, 52.4]);
    assert.deepEqual(rows.activity_rate.at(-1), ["Rural", "Oued Ed-Dahab", "-", "-", "-", "-", "-", 78.2, "-", "-", "-"]);
  });

  it("publishes every source value at its province, area and year, and nothing else", () => {
    const names = new Map(mappings.provinces.entries.map((entry) => [entry.source_name, entry.code]));
    const areas = new Map(mappings.areas.entries.map((entry) => [entry.source_label, entry.area]));
    const byKey = new Map(data.observations.map((item) => [`${item.code}|${item.area}|${item.year}`, item]));
    for (const field of LABOUR_FIELDS) {
      let numbers = 0;
      for (const row of rows[field].slice(2)) {
        row.slice(2).forEach((cell, column) => {
          const key = `${names.get(String(row[1]))}|${areas.get(String(row[0]))}|${2025 - column}`;
          const published = byKey.get(key)?.[field] ?? null;
          assert.equal(published, cell === "-" ? null : cell, `${field} ${key}`);
          if (typeof cell === "number") numbers++;
        });
      }
      assert.equal(data.observations.filter((item) => item[field] !== null).length, numbers, field);
    }
    assert.ok(data.observations.every((item) => LABOUR_FIELDS.some((field) => item[field] !== null)));
  });

  it("publishes the values recorded by HCP", () => {
    assert.deepEqual(find("al-hoceima", "all", 2024), {
      code: "al-hoceima", hcp_code: "01.051", name: { ar: "الحسيمة", fr: "Al Hoceima", en: "Al Hoceima" },
      region_code: "tanger-tetouan-al-hoceima", area: "all", year: 2024,
      activity_rate: 49.1, employment_rate: 45.2, unemployment_rate: 8,
    } satisfies LabourObservation);
    assert.deepEqual(data.observations.filter((item) => item.code === "oued-ed-dahab" && item.area === "rural").map((item) => item.year), [2020]);
    assert.equal(find("oued-ed-dahab", "rural", 2020)!.unemployment_rate, null);
    assert.deepEqual(data.observations.filter((item) => item.code === "tarfaya" && item.area === "all").map((item) => item.year),
      [2017, 2018, 2019, 2021, 2023, 2024, 2025]);
    assert.equal(find("assa-zag", "all", 2025)!.unemployment_rate, null);
    assert.equal(find("casablanca", "rural", 2025), undefined);
    assert.equal(find("fahs-anjra", "urban", 2025), undefined);
  });

  it("keeps the three rates consistent and links every province to its region", () => {
    let triples = 0;
    for (const item of data.observations) {
      const { activity_rate: act, employment_rate: emp, unemployment_rate: unemp } = item;
      if (act !== null && emp !== null) assert.ok(emp <= act, `${item.code} ${item.area} ${item.year}`);
      if (act !== null && emp !== null && unemp !== null) {
        triples++;
        assert.ok(Math.abs(emp - act * (1 - unemp / 100)) <= 0.12, `${item.code} ${item.area} ${item.year}`);
      }
    }
    assert.equal(triples, 1374);
    const provinces = new Map(geography.provinces.map((province) => [province.code, province]));
    for (const item of data.observations) {
      const province = provinces.get(item.code)!;
      assert.equal(item.region_code, province.region_code, item.code);
      assert.equal(item.hcp_code, province.hcp_code, item.code);
    }
    const order = data.observations.map((item) => `${item.code}|${["all", "urban", "rural"].indexOf(item.area)}|${item.year}`);
    assert.deepEqual(order, [...order].sort());
  });

  it("returns an immutable snapshot", () => {
    assert.ok(Object.isFrozen(data) && Object.isFrozen(data.years) && Object.isFrozen(data.observations));
    assert.ok(data.observations.every((item) => Object.isFrozen(item) && Object.isFrozen(item.name)));
  });
});

describe("population/labour mapping safety", () => {
  it("rejects a malformed mapping file", () => {
    assert.throws(() => assertLabourMappings({ ...copy(mappings), extra: {} }), /Invalid labour mapping file/);
    const area = copy(mappings) as unknown as { areas: { entries: { area: string }[] } };
    area.areas.entries[0]!.area = "national";
    assert.throws(() => assertLabourMappings(area), /Invalid labour area mapping at index 0/);
    const province = copy(mappings) as unknown as { provinces: { entries: { code: string }[] } };
    province.provinces.entries[0]!.code = "Al Hoceima";
    assert.throws(() => assertLabourMappings(province), /Invalid labour province mapping at index 0/);
    const sheet = copy(mappings) as unknown as { sheets: { entries: { field: string }[] } };
    sheet.sheets.entries[0]!.field = "participation_rate";
    assert.throws(() => assertLabourMappings(sheet), /Invalid labour sheet mapping at index 0/);
  });

  it("fails on a changed title, label column, year header or row count", () => {
    const title = mutable();
    title.activity_rate[0]![0] = "Autre titre";
    assert.throws(() => build(title), /Unexpected activity_rate sheet title row/);
    const label = mutable();
    label.employment_rate[1]![1] = "Provinces";
    assert.throws(() => build(label), /Unexpected employment_rate label columns/);
    const year = mutable();
    year.unemployment_rate[1]![2] = "2025*";
    assert.throws(() => build(year), /Unexpected unemployment_rate year header '2025\*'/);
    const gap = mutable();
    gap.activity_rate[1]![3] = "2023";
    assert.throws(() => build(gap), /consecutive years/);
    const shifted = mutable();
    shifted.unemployment_rate[1] = ["Milieu", "Provinces/Préfectures", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018"];
    assert.throws(() => build(shifted), /must cover the same years/);
    assert.throws(() => build({ ...rows, employment_rate: rows.employment_rate.slice(0, -1) }), /must have 214 rows/);
  });

  it("fails on an unmapped area or province, a duplicate row or an invalid value", () => {
    const area = mutable();
    area.activity_rate[2]![0] = "Périurbain";
    assert.throws(() => build(area), /Unmapped labour area 'Périurbain' in activity_rate row 2/);
    const province = mutable();
    province.unemployment_rate[2]![1] = "Aousserd";
    assert.throws(() => build(province), /Unmapped labour province 'Aousserd'/);
    const duplicate = mutable();
    duplicate.employment_rate[3]![1] = duplicate.employment_rate[2]![1]!;
    assert.throws(() => build(duplicate), /Duplicate labour row for al-hoceima\|all/);
    for (const value of [100.1, -1, "n.d.", null]) {
      const invalid = mutable();
      invalid.unemployment_rate[5]![4] = value;
      assert.throws(() => build(invalid), /Invalid unemployment_rate value/, String(value));
    }
  });

  it("fails when the sheets disagree or a rate is in the wrong column", () => {
    const extra = mutable();
    const casablancaRural = [...extra.unemployment_rate[2]!];
    casablancaRural[0] = "Rural";
    casablancaRural[1] = "Casablanca";
    extra.unemployment_rate.push(casablancaRural);
    const map = copy(mappings) as unknown as { sheets: { entries: { field: string; rows: number }[] } };
    map.sheets.entries.find((entry) => entry.field === "unemployment_rate")!.rows += 1;
    assert.throws(() => build(extra, map as unknown as LabourMappings), /rows missing from the activity sheet: casablanca\|rural/);

    const swapped = mutable();
    swapped.employment_rate = copy(rows.activity_rate) as (string | number | null)[][];
    swapped.employment_rate[0]![0] = mappings.sheets.entries.find((entry) => entry.field === "employment_rate")!.title;
    assert.throws(() => build(swapped), /differs from activity × \(1 − unemployment\)/);

    const above = mutable();
    const row = rowIndex("employment_rate", "Urbain", "Rabat");
    above.employment_rate[row]![2] = 99.9;
    assert.throws(() => build(above), /Employment rate exceeds activity rate for rabat\|urban in 2025/);

    const noAll = mutable();
    noAll.activity_rate[rowIndex("activity_rate", "National", "Al Hoceima")]![0] = "Urbain";
    assert.throws(() => build(noAll), /Duplicate labour row for al-hoceima\|urban|no all-areas activity row/);
  });

  it("fails on an unused, unknown or missing province mapping", () => {
    const unused = copy(mappings) as unknown as LabourMappings & { provinces: { entries: { source_name: string; code: string }[] } };
    unused.provinces.entries.push({ source_name: "Aousserd", code: "aousserd" });
    unused.unpublished_provinces = { ...unused.unpublished_provinces, entries: [] };
    assert.throws(() => build(rows, unused), /Unused labour province mappings: Aousserd/);
    const unknown = copy(mappings) as unknown as { provinces: { entries: { code: string }[] } };
    unknown.provinces.entries[0]!.code = "al-hoceima-province";
    assert.throws(() => build(rows, unknown as unknown as LabourMappings), /maps to unknown code 'al-hoceima-province'/);
    const missing = copy(mappings);
    (missing as { unpublished_provinces: { entries: unknown[] } }).unpublished_provinces.entries = [];
    assert.throws(() => build(rows, missing), /No labour mapping for provinces: aousserd/);
    const listed = copy(mappings) as unknown as { unpublished_provinces: { entries: { code: string }[] } };
    listed.unpublished_provinces.entries.push({ code: "rabat" });
    assert.throws(() => build(rows, listed as unknown as LabourMappings), /Unpublished labour province 'rabat'/);
  });
});
