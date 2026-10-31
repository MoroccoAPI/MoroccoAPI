import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConsulates, validateConsulateData } from "../../src/consulates/data.js";

describe("consulate data integrity", () => {
  it("validates the snapshot checksum and freezes nested values", async () => {
    const snapshot = await loadConsulates();
    assert.ok(Object.isFrozen(snapshot.consulates[0]!.phones));
    assert.equal(snapshot.consulates.length, snapshot.manifest.record_count);
    assert.equal(snapshot.manifest.raw_record_count, 57);
    assert.ok(!JSON.stringify(snapshot.consulates).includes("@"));
    assert.ok(snapshot.consulates.every((entry) => entry.phones.every((p) => !/GSM|mobile/i.test(p.raw))));
  });

  it("rejects duplicate records, personal fields, unsafe URLs and inconsistent metadata", async () => {
    const snapshot = await loadConsulates();
    const cases: ((data: any, manifest: any) => void)[] = [
      (data) => { data[1] = data[0]; },
      (data) => { data[0].official_name = "Example person"; },
      (data) => { data[0].website = "https://person@example.test"; },
      (data) => { data[0].website = "javascript:alert(1)"; },
      (data) => { data[0].country.code = "ZZ"; },
      (data) => { data[0].phones[0].e164 = "not-a-number"; },
      (_data, manifest) => { manifest.source_license = "ODbL-1.0"; },
      (_data, manifest) => { manifest.retrieved_at = "2026-02-30"; },
      (_data, manifest) => { manifest.record_count += 1; },
      (_data, manifest) => { manifest.countries += 1; },
    ];
    for (const mutate of cases) {
      const data = structuredClone(snapshot.consulates);
      const manifest = structuredClone(snapshot.manifest);
      mutate(data, manifest);
      assert.throws(() => validateConsulateData(data, manifest));
    }
  });
});
