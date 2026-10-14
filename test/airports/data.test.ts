import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";
import { loadAirports, validateAirports } from "../../src/airports/data.js";
import { buildDatasetMeta } from "../../src/airports/metadata.js";
import type { Airport } from "../../src/airports/types.js";

let raw: Airport[];
before(async () => {
  raw = JSON.parse(await readFile(new URL("../../data/airports/airports.json", import.meta.url), "utf8"));
});

describe("Airport snapshot", () => {
  it("retains all 45 MA entries and their source type/code coverage", async () => {
    const records = await loadAirports();
    assert.equal(records.length, 45);
    assert.ok(records.every((row) => row.iso_country === "MA"));
    assert.equal(records.filter((row) => row.icao_code !== null).length, 28);
    assert.equal(records.filter((row) => row.iata_code !== null).length, 21);
    assert.equal(records.filter((row) => row.scheduled_service).length, 17);
    assert.deepEqual(Object.fromEntries(["small_airport", "medium_airport", "large_airport", "heliport", "closed"].map((type) =>
      [type, records.filter((row) => row.type === type).length])),
    { small_airport: 17, medium_airport: 7, large_airport: 12, heliport: 2, closed: 7 });
    assert.deepEqual(records, raw);
    assert.deepEqual(records.map((row) => row.id), records.map((row) => row.id).sort((a, b) => a - b));
    assert.ok(Object.isFrozen(records));
    for (const row of records) {
      assert.ok(Object.isFrozen(row));
      if (row.location !== null) assert.ok(Object.isFrozen(row.location));
    }
  });

  it("preserves ICAO independently from source ident and GPS-like identifiers", () => {
    const records = validateAirports(raw);
    assert.equal(records.find((row) => row.ident === "GMMT")!.icao_code, null);
    assert.equal(records.find((row) => row.ident === "GMMY")!.icao_code, "GMMP");
    assert.equal(records.find((row) => row.ident === "MA-GLN")!.icao_code, "GMAG");
    assert.equal(records.find((row) => row.ident === "MA-0001")!.iata_code, null);
  });

  it("rejects incomplete snapshots and duplicate numeric IDs, idents or ICAO codes", () => {
    assert.throws(() => validateAirports(raw.slice(1)), /45 airports/);
    for (const field of ["id", "ident", "icao_code"] as const) {
      const changed = structuredClone(raw);
      (changed[1] as any)[field] = changed[0]![field];
      assert.throws(() => validateAirports(changed), /Duplicate airport identifier/);
    }
  });

  it("rejects malformed codes, foreign countries, unknown types and non-finite coordinates", () => {
    for (const mutate of [
      (row: any) => { row.icao_code = "MA-0001"; },
      (row: any) => { row.iata_code = "AB12"; },
      (row: any) => { row.iso_country = "EH"; },
      (row: any) => { row.iso_region = "US-CA"; },
      (row: any) => { row.type = "closed_airport"; },
      (row: any) => { row.scheduled_service = "yes"; },
      (row: any) => { row.location.latitude = 91; },
      (row: any) => { row.location.longitude = Number.NaN; },
    ]) {
      const changed = structuredClone(raw); mutate(changed[0]);
      assert.throws(() => validateAirports(changed), /Invalid airport|Invalid location/);
    }
  });

  it("keeps the dated public-domain source revision separate from retrieval and row verification", () => {
    const meta = buildDatasetMeta(3);
    assert.equal(meta.total, 3);
    assert.equal(meta.source_record_count, 45);
    assert.equal(meta.snapshot_date, "2026-10-14");
    assert.equal(meta.retrieved_at, "2026-10-15");
    assert.equal(meta.license, "Public-Domain");
    assert.match(meta.sources[0]!.resource_url, new RegExp(meta.source_revision));
    assert.ok(meta.limitations.some((text) => text.includes("not a verification date for each airport")));
  });
});
