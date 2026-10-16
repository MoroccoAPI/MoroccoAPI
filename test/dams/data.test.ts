import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { loadDams, validateDamData } from "../../src/dams/data.js";
import { buildDamMeta } from "../../src/dams/metadata.js";

describe("dams/data", () => {
  it("loads an immutable snapshot with complete daily observation keys", async () => {
    const data = await loadDams();
    assert.equal(data.dams.length, 5);
    assert.equal(data.levels.length, 305);
    assert.ok(Object.isFrozen(data));
    assert.ok(Object.isFrozen(data.dams));
    assert.ok(Object.isFrozen(data.levels));
    assert.ok(Object.isFrozen(data.manifest));
    assert.ok(Object.isFrozen(data.manifest.resources));
    for (const dam of data.dams) {
      assert.ok(Object.isFrozen(dam));
      assert.ok(Object.isFrozen(dam.name));
      assert.equal(data.levels.filter((level) => level.dam_id === dam.id).length, 61);
    }
    for (const level of data.levels) assert.ok(Object.isFrozen(level));
    const keys = data.levels.map((level) => `${level.dam_id}:${level.date}`);
    assert.equal(new Set(keys).size, 305);
  });

  it("rejects broken observation relationships, duplicate keys and invalid source values", async () => {
    const source = await loadDams();
    const copy = () => JSON.parse(JSON.stringify(source));

    const duplicateDam = copy();
    duplicateDam.dams[1] = duplicateDam.dams[0];
    assert.throws(() => validateDamData(duplicateDam.dams, duplicateDam.levels, duplicateDam.manifest));

    const duplicateLevel = copy();
    duplicateLevel.levels[1] = duplicateLevel.levels[0];
    assert.throws(() => validateDamData(duplicateLevel.dams, duplicateLevel.levels, duplicateLevel.manifest));

    const unknownDam = copy();
    unknownDam.levels[0]!.dam_id = "unknown-dam";
    assert.throws(() => validateDamData(unknownDam.dams, unknownDam.levels, unknownDam.manifest));

    const unknownSource = copy();
    unknownSource.levels[0]!.source_id = "unknown-source";
    assert.throws(() => validateDamData(unknownSource.dams, unknownSource.levels, unknownSource.manifest));

    for (const invalidDate of ["2026-02-30", "2026-04-31", "2099-01-01"]) {
      const invalid = copy();
      invalid.levels[0]!.date = invalidDate;
      assert.throws(() => validateDamData(invalid.dams, invalid.levels, invalid.manifest), invalidDate);
    }

    for (const field of ["volume_mm3", "filling_rate_pct", "capacity_mm3"] as const) {
      const invalid = copy();
      invalid.levels[0]![field] = -1;
      assert.throws(() => validateDamData(invalid.dams, invalid.levels, invalid.manifest), field);
    }

    const inconsistent = copy();
    inconsistent.levels[0].filling_rate_pct += 1;
    assert.throws(() => validateDamData(inconsistent.dams, inconsistent.levels, inconsistent.manifest));

    const invalidSheet = copy();
    invalidSheet.levels[0].source_ref.sheet = "unknown-sheet";
    assert.throws(() => validateDamData(invalidSheet.dams, invalidSheet.levels, invalidSheet.manifest));

    const invalidRow = copy();
    invalidRow.levels[0].source_ref.row += 1;
    assert.throws(() => validateDamData(invalidRow.dams, invalidRow.levels, invalidRow.manifest));

    const invalidPeriod = copy();
    invalidPeriod.manifest.resources[0].period = "2026-07";
    assert.throws(() => validateDamData(invalidPeriod.dams, invalidPeriod.levels, invalidPeriod.manifest));
  });

  it("keeps normalized observations, source attribution and API metadata consistent", async () => {
    const data = await loadDams();
    const manifest = JSON.parse(await readFile(new URL("../../data/dams/sources.json", import.meta.url), "utf8"));
    const meta = buildDamMeta(data, data.levels.length);
    assert.equal(meta.dataset, manifest.id);
    assert.equal(meta.total, manifest.coverage.observation_count);
    assert.equal(data.dams.length, manifest.coverage.dam_count);
    assert.equal(meta.coverage.from, manifest.coverage.start);
    assert.equal(meta.coverage.to, manifest.coverage.end);
    assert.equal(meta.coverage.real_time, manifest.coverage.live);
    assert.equal(meta.license, "ODbL-1.0");
    assert.equal(meta.license_url, manifest.license_url);
    assert.equal(new URL(manifest.source_url).hostname, "data.gov.ma");
    assert.ok(manifest.attribution.includes(manifest.producer));
    assert.ok(manifest.attribution.includes(manifest.license_url));
    assert.ok(manifest.attribution.includes("MoroccoAPI"));
    assert.equal(manifest.catalog_response_sha256, "12d2956ab75c6e7eaa66133523e7a5530eb3ff81edbd642322ecfc2096418ed3");

    const sources = new Map(data.manifest.resources.map((source) => [source.id, source]));
    assert.equal(sources.size, 2);
    assert.deepEqual(manifest.resources.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })), [
      { id: "abht-tensift-2026-08", bytes: 14178, sha256: "818c761003cc96ba0bf0fd3da076089f956020ac09905de97b2dbefef54358d7" },
      { id: "abht-tensift-2026-09", bytes: 1984212, sha256: "54195396f6358913416770b8dc2e90f1976d806186e50a96c75ca7fd6721eb46" },
    ]);
    for (const source of meta.sources) {
      const resource = sources.get(source.id)!;
      assert.equal(source.resource_url, resource.resource_url);
      assert.equal(new URL(source.resource_url).hostname, "data.gov.ma");
      assert.equal(source.source_url, manifest.source_url);
      assert.equal(source.producer, manifest.producer);
      assert.equal(source.license, manifest.source_license);
    }
    for (const level of data.levels) {
      const source = sources.get(level.source_id);
      assert.ok(source, `Missing source for ${level.dam_id} on ${level.date}`);
      assert.equal(level.date.slice(0, 7), source.period);
      assert.equal(level.source_ref.sheet, source.sheet);
    }
    for (const resource of manifest.resources) {
      assert.equal(data.levels.filter((level) => level.source_id === resource.id).length, resource.observation_count);
    }
  });
});
