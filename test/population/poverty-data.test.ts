import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { loadPovertyData, loadPovertyMappings, loadPovertyRows } from "../../src/population/poverty/data/poverty.js";
import {
  assertPovertyMappings, buildPovertySnapshot,
  type PovertyMappings, type PovertyRows,
} from "../../src/population/poverty/data/transform.js";
import { buildPovertyDatasetMeta } from "../../src/population/poverty/metadata.js";
import type { PovertyData } from "../../src/population/poverty/types.js";

let geography: GeographySnapshot;
let data: PovertyData;
let rows: PovertyRows;
let mappings: PovertyMappings;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const mutable = (source: PovertyRows) => copy(source) as Record<keyof PovertyRows, unknown[][]>;

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  [rows, mappings, data] = await Promise.all([loadPovertyRows(), loadPovertyMappings(), loadPovertyData(geography)]);
});

const find = (code: string | null) => {
  const index = data.territories.findIndex((territory) => territory.code === code);
  assert.ok(index >= 0, String(code));
  return { territory: data.territories[index]!, observations: data.observations[index]! };
};

describe("population/poverty data", () => {
  it("publishes every administrative territory once with the documented exclusions", () => {
    assert.equal(data.territories.length, 1640);
    assert.deepEqual(data.excluded, { cercles: 213, urban_centres: 164 });
    const levels = new Map<string, number>();
    for (const territory of data.territories) levels.set(territory.level, (levels.get(territory.level) ?? 0) + 1);
    assert.deepEqual(Object.fromEntries(levels), {
      national: 1, regions: 12, subdivisions: 75, "prefectures-of-arrondissements": 8, communes: 1503, arrondissements: 41,
    });
    const counts = new Map<string, number>();
    for (const list of data.observations) {
      for (const observation of list) counts.set(`${observation.area}|${observation.year}`, (counts.get(`${observation.area}|${observation.year}`) ?? 0) + 1);
    }
    assert.deepEqual(Object.fromEntries(counts), {
      "all|2024": 1640, "all|2014": 1640, "urban|2024": 518, "urban|2014": 502, "rural|2024": 1368, "rural|2014": 1368,
    });
  });

  it("matches the checksums and coverage recorded in the source manifest", async () => {
    const manifest = await readFile(new URL("../../sources/population/multidimensional-poverty.yml", import.meta.url), "utf8");
    const files = [...manifest.matchAll(/- file: (\S+)\n\s+sha256: ([0-9a-f]{64})/g)];
    assert.deepEqual(files.map((match) => match[1]), [
      "data/population/source/multidimensional-poverty-all.json",
      "data/population/source/multidimensional-poverty-urban.json",
      "data/population/source/multidimensional-poverty-rural.json",
      "data/population/poverty-mappings.json",
    ]);
    for (const [, path, expected] of files) {
      const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
    }
    const coverage = (key: string) => Number(manifest.match(new RegExp(`\\n  ${key}: (\\d+)`))?.[1]);
    const observations = data.observations.flat();
    assert.equal(coverage("published_territories"), data.territories.length);
    assert.equal(coverage("all_area_observations"), observations.filter((item) => item.area === "all").length);
    assert.equal(coverage("urban_observations"), observations.filter((item) => item.area === "urban").length);
    assert.equal(coverage("rural_observations"), observations.filter((item) => item.area === "rural").length);
    assert.equal(coverage("excluded_cercles"), data.excluded.cercles);
    assert.equal(coverage("excluded_urban_centres"), data.excluded.urban_centres);
    assert.equal(coverage("source_rows_per_sheet"), rows.all.length);
    const meta = buildPovertyDatasetMeta(0);
    assert.match(manifest, new RegExp(`\\nretrieved_at: ${meta.retrieved_at}\\n`));
    assert.match(manifest, new RegExp(`source_updated_at: ${meta.sources[0].source_updated_at}\\n`));
    assert.match(manifest, new RegExp(`resource_url: ${meta.sources[0].resource_url}\\n`));
  });

  it("keeps the source sheets verbatim, including footnotes and symbols", () => {
    for (const area of ["all", "urban", "rural"] as const) {
      assert.equal(rows[area].length, 4043);
      assert.ok(rows[area].every((row) => row.length === 35));
      assert.match(String(rows[area].at(-3)![0]), /^\* Les indicateurs de pauvreté de ces communes en 2014/);
    }
    assert.deepEqual(rows.all[6]!.slice(0, 4), ["Ensemble du territoire national", 0, "national", 2024]);
    assert.equal(rows.all[6]![31], "---");
    assert.equal(mappings.columns.entries.length, 105);
    assert.deepEqual(mappings.mpi_trend_symbols.entries.map((entry) => entry.symbol), ["---", "+++", "Stag", "nc"]);
  });

  it("publishes the national, regional and commune values as recorded by HCP", () => {
    const national = find(null).observations;
    assert.deepEqual(national.map((item) => `${item.area}|${item.year}`), [
      "all|2024", "all|2014", "urban|2024", "urban|2014", "rural|2024", "rural|2014",
    ]);
    const [latest, earlier] = national;
    assert.equal(latest!.poverty_rate, 6.7524004089707095);
    assert.equal(latest!.mpi, 0.024789337068796158);
    assert.equal(latest!.mpi_trend, "decrease");
    assert.equal(earlier!.poverty_rate, 11.868601688239057);
    assert.equal(earlier!.mpi_trend, null);
    assert.equal(latest!.deprivation_rates.disability, 16.959952954680286);
    const rabat = find("rabat--rabat");
    assert.equal(rabat.territory.level, "communes");
    assert.deepEqual(rabat.observations.map((item) => item.area), ["all", "all", "urban", "urban"]);
  });

  it("flags only the 2014 values HCP aligned on Dakhla", () => {
    const flagged = data.territories.flatMap((territory, index) =>
      data.observations[index]!.some((item) => item.aligned_with_dakhla) ? [territory.code] : []);
    assert.deepEqual(flagged, ["oued-ed-dahab--mijik", "aousserd--lagouira", "aousserd--aghouinite", "aousserd--zoug"]);
    for (const list of data.observations) {
      assert.ok(list.every((item) => !item.aligned_with_dakhla || item.year === 2014));
    }
    const dakhla = find("oued-ed-dahab--dakhla").observations.find((item) => item.area === "all" && item.year === 2014)!;
    const mijik = find("oued-ed-dahab--mijik").observations.find((item) => item.area === "all" && item.year === 2014)!;
    assert.equal(mijik.poverty_rate, dakhla.poverty_rate);
  });

  it("leaves MPI and intensity null where HCP reports no poor population", () => {
    const zeroRates = data.observations.flat().filter((item) => item.poverty_rate === 0);
    assert.ok(zeroRates.length > 0);
    assert.ok(zeroRates.every((item) => item.mpi === null && item.poverty_intensity === null));
    for (const item of data.observations.flat()) {
      if (item.mpi !== null && item.poverty_rate !== null && item.poverty_intensity !== null) {
        assert.ok(Math.abs(item.mpi - item.poverty_rate * item.poverty_intensity / 10000) < 1e-6);
      }
    }
  });

  it("returns an immutable snapshot", () => {
    assert.ok(Object.isFrozen(data) && Object.isFrozen(data.territories) && Object.isFrozen(data.observations));
    assert.ok(data.observations.every((list) => Object.isFrozen(list) &&
      list.every((item) => Object.isFrozen(item) && Object.isFrozen(item.deprivation_rates))));
    assert.ok(data.territories.every((territory) => Object.isFrozen(territory) && Object.isFrozen(territory.name)));
  });
});

describe("population/poverty mapping safety", () => {
  const build = (source: PovertyRows = rows, map: PovertyMappings = mappings) => buildPovertySnapshot(source, map, geography);

  it("fails on a changed header, title or footnote", () => {
    const header = mutable(rows);
    header.urban[4]![5] = "Taux de pauvreté";
    assert.throws(() => build(header as PovertyRows), /Header of urban poverty column 5/);
    const title = mutable(rows);
    title.rural[0]![0] = "Autre titre";
    assert.throws(() => build(title as PovertyRows), /must start with its title/);
    const footer = mutable(rows);
    footer.all.at(-1)![3] = 2024;
    assert.throws(() => build(footer as PovertyRows), /must end with 3 footnote rows/);
  });

  it("fails when the sheets disagree or a territory is missing", () => {
    const misaligned = mutable(rows);
    misaligned.rural[100]![1] = 999;
    assert.throws(() => build(misaligned as PovertyRows), /rural poverty sheet must list the same territories/);
    const missing = mutable(rows);
    const index = missing.all.findIndex((row) => row[0] === "Commune de Tanger");
    for (const area of ["all", "urban", "rural"] as const) {
      missing[area][index]![0] = "Cercle de Test";
      missing[area][index + 1]![0] = "Cercle de Test";
    }
    assert.throws(() => build(missing as PovertyRows), /No poverty rows for communes: 01\.511\.01\.0/);
  });

  it("fails on an out-of-range value, an unknown symbol or an inconsistent MPI", () => {
    const range = mutable(rows);
    range.all[8]![5] = 140;
    assert.throws(() => build(range as PovertyRows), /Invalid poverty_rate value in all row 2/);
    const symbol = mutable(rows);
    symbol.all[6]![31] = "??";
    assert.throws(() => build(symbol as PovertyRows), /Invalid MPI trend '\?\?'/);
    const trend2014 = mutable(rows);
    trend2014.all[7]![31] = "---";
    assert.throws(() => build(trend2014 as PovertyRows), /Invalid MPI trend '---' in all row 1/);
    const mpi = mutable(rows);
    mpi.all[6]![4] = 0.5;
    assert.throws(() => build(mpi as PovertyRows), /MPI differs from poverty rate × intensity/);
  });

  it("fails on an unlisted * marker or an unused Dakhla alignment", () => {
    const marked = mutable(rows);
    marked.all[8]![0] = `${String(marked.all[8]![0])}*`;
    assert.throws(() => build(marked as PovertyRows), /is marked \* but is not listed/);
    const stale = copy(mappings);
    stale.aligned_with_dakhla_2014.entries = [...stale.aligned_with_dakhla_2014.entries, { source_code: "1511010" }];
    assert.throws(() => build(rows, stale), /Listed Dakhla-aligned commune 'Commune de Tanger' is not marked \* in 2014/);
  });

  it("rejects malformed or incomplete mapping files", () => {
    assert.throws(() => assertPovertyMappings({ sheets: { entries: [] } }), /Invalid poverty mapping file/);
    const role = copy(mappings) as unknown as { columns: { entries: Record<string, unknown>[] } };
    role.columns.entries[0]!.role = "label";
    assert.throws(() => assertPovertyMappings(role), /Invalid poverty column mapping at index 0/);
    const dropped = copy(mappings);
    dropped.columns.entries = dropped.columns.entries.filter((entry) => !(entry.area === "all" && entry.column === 34));
    assert.throws(() => build(rows, dropped), /must list the 35 all poverty columns in order/);
  });
});
