import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadInsuranceIntermediaries, validateInsuranceData } from "../../src/insurance/data.js";

describe("insurance snapshot integrity", () => {
  it("checks the file checksum, retains source blanks, and freezes the snapshot", async () => {
    const snapshot = await loadInsuranceIntermediaries();
    assert.equal(snapshot.intermediaries.length, 3607);
    assert.equal(snapshot.manifest.source_record_count, 3614);
    assert.equal(snapshot.manifest.captured_source_record_count, 3614);
    assert.equal(snapshot.manifest.coverage_complete, true);
    assert.equal(new Set(snapshot.intermediaries.map((row) => JSON.stringify(row))).size, snapshot.manifest.record_count);
    assert.ok(snapshot.intermediaries.some((row) => row.category === "broker" && row.insurer === null));
    assert.ok(snapshot.intermediaries.some((row) => row.name === null));
    assert.ok(Object.isFrozen(snapshot.intermediaries));
    assert.ok(Object.isFrozen(snapshot.intermediaries[0]));
    assert.ok(Object.isFrozen(snapshot.manifest.limitations));
  });

  it("rejects duplicate records, unexpected fields, invalid dates and inconsistent counts", async () => {
    const snapshot = await loadInsuranceIntermediaries();
    const mutations: ((rows: any, manifest: any) => void)[] = [
      (rows) => { rows[1] = structuredClone(rows[0]); },
      (rows) => { rows[0].acaps_code = "A/123"; },
      (rows) => { rows[0].category = "unknown"; },
      (rows) => { rows[0].phone = "+212600000000"; },
      (rows) => { rows[0].name = ""; },
      (rows) => { rows[0].insurer = " "; },
      (_rows, manifest) => { manifest.retrieved_at = "2026-02-30"; },
      (_rows, manifest) => { manifest.record_count++; },
      (_rows, manifest) => { manifest.source_record_count = 1; },
      (_rows, manifest) => { manifest.captured_source_record_count = manifest.record_count; },
    ];
    for (const mutate of mutations) {
      const rows = structuredClone(snapshot.intermediaries);
      const manifest = structuredClone(snapshot.manifest);
      mutate(rows, manifest);
      assert.throws(() => validateInsuranceData(rows, manifest));
    }
  });
});
