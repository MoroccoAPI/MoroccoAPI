import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { loadDams, validateDamData } from "../../src/dams/data.js";
import { buildDamMeta } from "../../src/dams/metadata.js";

const nationalSourceId = "maadialna-2026-10-12";
const historicalIds = [
  "abou-el-abess-sebti", "bge-my-abdrhmane", "lalla-takerkoust",
  "sd-mohamed-ben-slimane-el-jazouli", "yacoub-el-mansour",
];

describe("dams/data", () => {
  it("loads an immutable snapshot and merges the two shared dams without duplicate observations", async () => {
    const data = await loadDams();
    assert.equal(data.dams.length, 25);
    assert.equal(data.levels.length, 327);
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data.dams));
    assert.ok(Object.isFrozen(data.levels));
    assert.ok(Object.isFrozen(data.manifest));
    assert.ok(Object.isFrozen(data.manifest.resources));
    for (const dam of data.dams) {
      assert.ok(Object.isFrozen(dam));
      assert.ok(Object.isFrozen(dam.name));
      const expected = ["bge-my-abdrhmane", "yacoub-el-mansour"].includes(dam.id)
        ? 62 : historicalIds.includes(dam.id) ? 61 : 1;
      assert.equal(data.levels.filter((level) => level.dam_id === dam.id).length, expected, dam.id);
    }
    for (const level of data.levels) {
      assert.ok(Object.isFrozen(level));
      assert.ok(Object.isFrozen(level.source_ref));
    }
    assert.equal(new Set(data.dams.map((dam) => dam.id)).size, 25);
    assert.equal(new Set(data.levels.map((level) => `${level.dam_id}:${level.date}`)).size, 327);
    assert.equal(data.levels.filter((level) => level.source_id === nationalSourceId).length, 22);
    assert.equal(data.levels.filter((level) => level.source_id.startsWith("abht-tensift-")).length, 305);
    assert.ok(data.levels.every((level) => level.date.startsWith("2026-")));
  });

  it("rejects broken relationships, duplicate keys and invalid historical source values", async () => {
    const source = await loadDams();
    const copy = () => JSON.parse(JSON.stringify(source));
    const rejects = (invalid: ReturnType<typeof copy>) =>
      assert.throws(() => validateDamData(invalid.dams, invalid.levels, invalid.manifest));
    const historical = (snapshot: ReturnType<typeof copy>) => snapshot.levels.find(
      (level: { source_id: string }) => level.source_id === "abht-tensift-2026-08",
    );

    const duplicateDam = copy();
    duplicateDam.dams[1] = duplicateDam.dams[0];
    rejects(duplicateDam);

    const duplicateLevel = copy();
    duplicateLevel.levels[1] = duplicateLevel.levels[0];
    rejects(duplicateLevel);

    const unknownDam = copy();
    historical(unknownDam).dam_id = "unknown-dam";
    rejects(unknownDam);

    const unknownSource = copy();
    historical(unknownSource).source_id = "unknown-source";
    rejects(unknownSource);

    for (const invalidDate of ["2026-02-30", "2026-04-31", "2099-01-01"]) {
      const invalid = copy();
      historical(invalid).date = invalidDate;
      rejects(invalid);
    }
    for (const field of ["volume_mm3", "filling_rate_pct", "capacity_mm3"] as const) {
      const invalid = copy();
      historical(invalid)[field] = -1;
      rejects(invalid);
    }

    const inconsistent = copy();
    historical(inconsistent).filling_rate_pct += 1;
    rejects(inconsistent);

    const invalidSheet = copy();
    historical(invalidSheet).source_ref.sheet = "unknown-sheet";
    rejects(invalidSheet);

    const invalidRow = copy();
    historical(invalidRow).source_ref.row += 1;
    rejects(invalidRow);

    const invalidPeriod = copy();
    invalidPeriod.manifest.resources[0].period = "2026-07";
    rejects(invalidPeriod);
  });

  it("validates dashboard date provenance, source positions and unknown capacity without inventing history", async () => {
    const source = await loadDams();
    for (const change of [
      (level: Record<string, any>) => { level.date = "2026-10-11"; },
      (level: Record<string, any>) => { level.date_basis = "source_calendar"; },
      (level: Record<string, any>) => { delete level.date_basis; },
      (level: Record<string, any>) => { level.capacity_mm3 = 506.6; },
      (level: Record<string, any>) => { level.previous_year_filling_rate_pct = -1; },
      (level: Record<string, any>) => { delete level.previous_year_filling_rate_pct; },
      (level: Record<string, any>) => { level.source_ref.basin_code = "MH7"; },
      (level: Record<string, any>) => { level.source_ref.dam_index = 1; },
      (level: Record<string, any>) => { level.source_ref.dam_index = 1.5; },
      (level: Record<string, any>) => { level.source_ref = { sheet: "Sept_2026", row: 15 }; },
      (level: Record<string, any>) => { level.dam_id = "yacoub-el-mansour"; },
    ]) {
      const invalid = JSON.parse(JSON.stringify(source));
      const level = invalid.levels.find((item: { dam_id: string; source_id: string }) =>
        item.dam_id === "tiddas" && item.source_id === nationalSourceId);
      assert.ok(level);
      change(level);
      assert.throws(() => validateDamData(invalid.dams, invalid.levels, invalid.manifest));
    }

    const tiddas = source.levels.find((level) => level.dam_id === "tiddas")!;
    assert.equal(tiddas.date, "2026-10-12");
    assert.equal(tiddas.date_basis, "dashboard_headline");
    assert.equal(tiddas.capacity_mm3, null);
    assert.equal(tiddas.previous_year_filling_rate_pct, null);
    assert.equal(tiddas.volume_mm3, 461);
    assert.equal(tiddas.filling_rate_pct, 91);
    assert.deepEqual(tiddas.source_ref, { basin_code: "MH5", dam_index: 2 });
    const national = source.levels.filter((level) => level.source_id === nationalSourceId);
    assert.ok(national.every((level) => level.capacity_mm3 === null && level.date === "2026-10-12"));
    assert.ok(national.some((level) => level.previous_year_filling_rate_pct !== null));
  });

  it("keeps source attribution, mixed licensing and partial national coverage explicit", async () => {
    const data = await loadDams();
    const manifest = JSON.parse(await readFile(new URL("../../data/dams/sources.json", import.meta.url), "utf8"));
    const meta = buildDamMeta(data, data.levels.length);
    assert.equal(meta.dataset, "morocco-dams");
    assert.equal(meta.dataset, manifest.id);
    assert.equal(meta.total, manifest.coverage.observation_count);
    assert.equal(data.dams.length, manifest.coverage.dam_count);
    assert.equal(meta.coverage.from, manifest.coverage.start);
    assert.equal(meta.coverage.to, manifest.coverage.end);
    assert.equal(meta.coverage.real_time, false);
    assert.equal(meta.coverage.complete_national_coverage, false);
    assert.equal(meta.license, "mixed");
    assert.equal(meta.license_url, null);
    assert.equal(meta.coverage.basins.length, 9);
    assert.deepEqual(meta.coverage.basins, [...new Set(data.dams.map((dam) => dam.basin))].sort());
    assert.ok(meta.coverage.limitations.some((note) => /licen[cs]e/i.test(note)));
    assert.ok(meta.coverage.limitations.some((note) => /date|headline/i.test(note)));
    assert.ok(meta.coverage.limitations.some((note) => /capacity/i.test(note)));

    const sources = new Map(data.manifest.resources.map((source) => [source.id, source]));
    assert.equal(sources.size, 3);
    for (const source of meta.sources) {
      const resource = sources.get(source.id)!;
      assert.equal(source.resource_url, resource.resource_url);
      assert.ok(source.producer.length > 0);
      if (source.id === nationalSourceId) {
        assert.equal(new URL(source.resource_url).hostname, "maadialna.ma");
        assert.equal(new URL(source.source_url).hostname, "maadialna.ma");
        assert.equal(source.license, null);
        assert.equal(source.license_url, null);
      } else {
        assert.equal(new URL(source.resource_url).hostname, "data.gov.ma");
        assert.equal(new URL(source.source_url).hostname, "data.gov.ma");
        assert.equal(source.license, "ODbL-1.0");
        assert.equal(source.license_url, "https://opendatacommons.org/licenses/odbl/1-0/");
      }
    }
    for (const level of data.levels) {
      const source = sources.get(level.source_id);
      assert.ok(source, `Missing source for ${level.dam_id} on ${level.date}`);
      assert.equal(level.date.slice(0, 7), source.period);
      if ("sheet" in level.source_ref) assert.equal(level.source_ref.sheet, source.sheet);
    }
    for (const resource of manifest.resources) {
      assert.equal(data.levels.filter((level) => level.source_id === resource.id).length, resource.observation_count);
    }
  });
});
