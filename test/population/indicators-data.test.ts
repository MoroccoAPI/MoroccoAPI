import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import { loadCommunePopulation } from "../../src/population/data/communes.js";
import { loadNationalPopulation } from "../../src/population/data/population.js";
import { loadRegionPopulation } from "../../src/population/data/regions.js";
import { loadSubdivisionPopulation } from "../../src/population/data/subdivisions.js";
import {
  assertIndicatorMappings, buildIndicatorSnapshot,
  type IndicatorMappings, type SourceRows,
} from "../../src/population/indicators/data/transform.js";
import { loadPopulationIndicators } from "../../src/population/indicators/data/indicators.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import type { ExistingPopulation } from "../../src/population/indicators/data/transform.js";
import type { PopulationIndicatorsData } from "../../src/population/indicators/types.js";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const json = async (path: string): Promise<unknown> => JSON.parse(await read(path));

let geography: GeographySnapshot;
let existing: ExistingPopulation;
let data: PopulationIndicatorsData;
let rows: SourceRows;
let mappings: IndicatorMappings;

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  const [national, regionPopulation, subdivisions, communes] = await Promise.all([
    loadNationalPopulation(),
    loadRegionPopulation(geography.regions),
    loadSubdivisionPopulation(geography),
    loadCommunePopulation(geography),
  ]);
  existing = { national, regions: regionPopulation, subdivisions, communes };
  const [population, households, rawMappings] = await Promise.all([
    json("data/population/source/rgph-2024-indicators-population.json"),
    json("data/population/source/rgph-2024-indicators-households.json"),
    json("data/population/indicators-mappings.json"),
  ]);
  assertIndicatorMappings(rawMappings);
  rows = { population: population as SourceRows["population"], households: households as SourceRows["households"] };
  mappings = rawMappings;
  data = await loadPopulationIndicators(geography, existing);
});

describe("population/indicators data", () => {
  it("publishes the documented groups, indicators, territories and exclusions", () => {
    assert.equal(data.groups.length, 7);
    assert.equal(data.indicators.length, 98);
    assert.equal(data.territories.length, 1640);
    assert.deepEqual(data.excluded, { cercles: 213, urban_centres: 164 });
    assert.deepEqual(
      Object.fromEntries(data.territories.reduce((counts, territory) => {
        counts.set(territory.level, (counts.get(territory.level) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())),
      {
        national: 1,
        regions: 12,
        subdivisions: 75,
        "prefectures-of-arrondissements": 8,
        communes: 1503,
        arrondissements: 41,
      },
    );
    assert.equal(data.values.length, data.territories.length);
    assert.ok(data.values.every((row) => row.length === data.indicators.length));
    assert.deepEqual(data.indicators.slice(0, 3).map((indicator) => indicator.id), [
      "legal-population", "municipal-population", "male-share",
    ]);
  });

  it("preserves source rows and mappings with complete column coverage", () => {
    assert.equal(rows.population.length, 2020);
    assert.equal(rows.households.length, 2019);
    assert.equal(rows.population[0]![0], "Milieu de résidence : Ensemble");
    assert.equal(rows.households[0]![0], "Milieu de résidence : Ensemble");
    assert.equal(rows.population[0]!.length, 191);
    assert.equal(rows.households[0]!.length, 38);
    assert.equal(mappings.groups.entries.length, 7);
    assert.equal(mappings.indicators.entries.length, 98);
    assert.equal(mappings.columns.entries.length, 229);
    assert.equal(mappings.local_administration_communes.entries.length, 4);
    assert.deepEqual(mappings.local_administration_communes.entries.map((entry) => entry.source_code), [
      "120660103", "120660303", "120660309", "123910505",
    ]);
  });

  it("keeps values and null reasons internally consistent and freezes the snapshot", () => {
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data.groups));
    assert.ok(Object.isFrozen(data.indicators));
    assert.ok(Object.isFrozen(data.territories));
    assert.ok(Object.isFrozen(data.values));
    for (const row of data.values) {
      assert.ok(Object.isFrozen(row));
      for (const value of row) {
        assert.ok(Object.isFrozen(value));
        assert.ok(Object.isFrozen(value.null_reasons));
        for (const sex of ["both_sexes", "male", "female"] as const) {
          if (value[sex] === null) assert.notEqual(value.null_reasons[sex], null);
          else {
            assert.equal(value.null_reasons[sex], null);
            assert.ok(Number.isFinite(value[sex]) && value[sex] >= 0);
          }
        }
      }
    }
    assert.ok(data.territories.filter((territory) => territory.data_from_local_administration).length === 4);
    assert.deepEqual(
      data.territories.filter((territory) => territory.data_from_local_administration).map((territory) => territory.code),
      ["oued-ed-dahab--mijik", "aousserd--lagouira", "aousserd--aghouinite", "aousserd--zoug"],
    );
  });

  it("matches existing population counts for every published legal population record", () => {
    const positions = new Map(data.indicators.map((indicator, index) => [indicator.id, index]));
    const legal = positions.get("legal-population")!;
    const households = positions.get("households")!;
    const expected = new Map<string, { population: number; households?: number }>([
      ["national|", { population: existing.national.total }],
      ...existing.regions.map((record) => [`regions|${record.code}`, { population: record.population }] as const),
      ...existing.subdivisions.map((record) => [`subdivisions|${record.code}`, { population: record.population, households: record.households }] as const),
      ...existing.communes.map((record) => [`communes|${record.code}`, { population: record.population, households: record.households }] as const),
    ]);
    for (const [index, territory] of data.territories.entries()) {
      const reference = expected.get(`${territory.level}|${territory.code ?? ""}`);
      if (!reference) continue;
      assert.equal(data.values[index]![legal]!.both_sexes, reference.population, territory.code ?? "national");
      if (reference.households !== undefined) {
        assert.equal(data.values[index]![households]!.both_sexes, reference.households, territory.code);
      }
    }
  });

  it("rejects malformed mappings, changed headers, repeated values and broken geography links", () => {
    assert.throws(() => assertIndicatorMappings({}), /Invalid population indicator mapping file/);

    const changedHeader = structuredClone(mappings) as IndicatorMappings;
    const changedHeaderColumns = changedHeader.columns.entries as Array<Record<string, unknown>>;
    changedHeaderColumns[2]!.source_label = "Changed header";
    assert.throws(
      () => buildIndicatorSnapshot(rows, changedHeader, geography, existing),
      /Header of population column 2/,
    );

    const repeated = structuredClone(rows) as SourceRows;
    const duplicate = mappings.columns.entries.find((entry) => entry.role === "duplicate");
    assert.ok(duplicate && duplicate.role === "duplicate");
    const sheet = mappings.sheets.entries.find((entry) => entry.sheet === duplicate.sheet)!;
    const duplicateRows = repeated[duplicate.sheet] as Array<unknown[]>;
    const original = duplicateRows[sheet.header_rows]![duplicate.column];
    duplicateRows[sheet.header_rows]![duplicate.column] = typeof original === "number" ? original + 1 : 0;
    assert.throws(
      () => buildIndicatorSnapshot(repeated, mappings, geography, existing),
      /Repeated .* differs in row/,
    );

    const brokenGeography = {
      ...geography,
      regions: geography.regions.map((region, index) => index === 0 ? { ...region, hcp_code: "99" } : region),
    };
    assert.throws(
      () => buildIndicatorSnapshot(rows, mappings, brokenGeography, existing),
      /does not match exactly one regions record/,
    );
  });

  it("matches every committed checksum and coverage value in the source manifest", async () => {
    const manifest = await read("sources/population/rgph-2024-indicators.yml");
    const files = [...manifest.matchAll(/^  - file: (.+)\n    sha256: ([0-9a-f]{64})$/gm)];
    assert.deepEqual(files.map((match) => match[1]), [
      "data/population/source/rgph-2024-indicators-population.json",
      "data/population/source/rgph-2024-indicators-households.json",
      "data/population/indicators-mappings.json",
    ]);
    for (const [, path, expected] of files) {
      const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
    }
    const coverage = (key: string) => Number(manifest.match(new RegExp(`^  ${key}: (\\d+)$`, "m"))?.[1]);
    assert.equal(coverage("indicator_groups"), data.groups.length);
    assert.equal(coverage("indicators"), data.indicators.length);
    assert.equal(coverage("published_territories"), data.territories.length);
    assert.equal(coverage("excluded_cercles"), data.excluded.cercles);
    assert.equal(coverage("excluded_urban_centres"), data.excluded.urban_centres);
    assert.match(manifest, /^retrieved_at: 2026-10-20$/m);
    assert.match(manifest, /^    source_file_sha256: f3d96fcae3c10a2c194b2fe97ee8352a242fb3f36b1b63d4d2a7006176dc7c3e$/m);
  });
});
