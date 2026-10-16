import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { loadDams, validateDamData } from "../../src/dams/data.js";

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

  it("retains the exact licensed source workbooks and resolvable provenance", async () => {
    const data = await loadDams();
    const manifest = JSON.parse(await readFile(new URL("../../data/dams/sources.json", import.meta.url), "utf8"));
    assert.equal(manifest.source_license, "ODbL-1.0");
    const metadataRaw = await readFile(new URL(`../../data/dams/${manifest.metadata_snapshot.raw_file}`, import.meta.url));
    assert.equal(metadataRaw.byteLength, manifest.metadata_snapshot.bytes);
    assert.equal(createHash("sha256").update(metadataRaw).digest("hex"), manifest.metadata_snapshot.sha256);
    const catalog = JSON.parse(metadataRaw.toString("utf8")).result;
    assert.equal(catalog.license_id, "odc-odbl");
    assert.equal(catalog.isopen, true);
    const sourceIds = new Set<string>();
    for (const resource of manifest.resources) {
      const raw = await readFile(new URL(`../../data/dams/${resource.raw_file}`, import.meta.url));
      assert.equal(raw.byteLength, resource.bytes);
      assert.equal(createHash("sha256").update(raw).digest("hex"), resource.sha256);
      assert.ok(resource.resource_url.startsWith("https://data.gov.ma/"));
      sourceIds.add(resource.id);
    }
    assert.equal(sourceIds.size, 2);
    for (const level of data.levels) assert.ok(sourceIds.has(level.source_id));
  });
});
