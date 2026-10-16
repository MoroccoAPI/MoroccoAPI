import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";
import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { validateMuseums } from "../../src/museums/data.js";

let geography: GeographySnapshot;
let raw: any[];
before(async () => {
  const regions = await loadRegions();
  geography = { regions, ...await loadGeography(regions) };
  raw = JSON.parse(await readFile(new URL("../../data/museums/museums.json", import.meta.url), "utf8"));
});

describe("Museum snapshot validation", () => {
  it("validates the complete geography and exposes immutable visitor records", () => {
    const records = validateMuseums(raw, geography);
    assert.equal(records.length, 23);
    assert.equal(new Set(records.map((r) => r.city_code)).size, 11);
    assert.equal(new Set(records.map((r) => r.region_code)).size, 7);
    assert.ok(Object.isFrozen(records));
    for (const record of records) {
      assert.ok(Object.isFrozen(record) && Object.isFrozen(record.name) && Object.isFrozen(record.contact));
      assert.ok(Object.isFrozen(record.contact.social_handles) && Object.isFrozen(record.quality_flags));
    }
  });

  it("rejects missing or duplicate source museums", () => {
    assert.throws(() => validateMuseums(raw.slice(1), geography), /23 museums/);
    const duplicate = structuredClone(raw);
    duplicate[1].id = duplicate[0].id;
    assert.throws(() => validateMuseums(duplicate, geography), /Duplicate museum ID/);
  });

  it("rejects unknown cities, unknown regions and incompatible geography", () => {
    for (const mutate of [
      (r: any) => { r.region_code = "oriental"; },
      (r: any) => { r.region_code = "invalid"; },
      (r: any) => { r.city_code = "invalid"; },
    ]) {
      const changed = structuredClone(raw); mutate(changed[0]);
      assert.throws(() => validateMuseums(changed, geography), /Invalid museum geography/);
    }
  });

  it("rejects malformed names, phones, coordinates and status claims", () => {
    for (const mutate of [
      (r: any) => { r.name.ar = ""; },
      (r: any) => { r.contact.phone_e164 = "+212123"; },
      (r: any) => { r.operating_status = "open"; },
      (r: any) => { r.coordinates = { latitude: 34, longitude: -6 }; },
    ]) {
      const changed = structuredClone(raw); mutate(changed[0]);
      assert.throws(() => validateMuseums(changed, geography), /Invalid museum record/);
    }
  });
});
