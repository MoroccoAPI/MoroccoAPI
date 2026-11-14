import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { buildRailDataset, loadRailDataset, validateStations } from "../../src/rail/data/stations.js";
import { transformStations } from "../../src/rail/data/transform.js";

const root = new URL("../../data/rail/", import.meta.url);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

describe("Pinned rail snapshot", () => {
  it("reproduces every normalized field from checked-in source evidence and reviewed mappings", async () => {
    const { records, manifest } = await loadRailDataset();
    const [raw, mappings] = await Promise.all(["source/osm-stations.json", "mappings.json"].map((path) => readFile(new URL(path, root), "utf8")));
    assert.equal(hash(raw!), manifest.raw_sha256);
    assert.equal(hash(mappings!), manifest.mappings_sha256);
    assert.equal(hash(JSON.stringify(records, null, 2) + "\n"), manifest.stations_sha256);
    const result = transformStations(JSON.parse(raw!), JSON.parse(mappings!));
    assert.deepEqual(result.stations, records);
    assert.deepEqual(result.coverage, manifest.coverage);
    assert.deepEqual(result.warnings, manifest.warnings);
    assert.equal(manifest.warnings.length, 4);
    assert.equal(manifest.source.snapshot_at, "2026-11-13T21:22:20Z");
    assert.equal(manifest.source.retrieved_at, "2026-11-14");
    assert.equal(manifest.raw_record_count, 178);
    assert.equal(records.length, 151);
    assert.equal(records.reduce((count, row) => count + row.sources.length, 0) + manifest.excluded.length, manifest.raw_record_count);
    assert.equal(records.filter((s) => s.type === "halt").length, 5);
    assert.ok(records.every((s) => s.connections === null && s.passenger_service === null));
    assert.ok(Object.isFrozen(records) && Object.isFrozen(records[0]!.names) && Object.isFrozen(records[0]!.sources[0]!.fields));
  });

  it("fails startup on altered source bytes, mappings, provenance or output metadata", async () => {
    const [raw, mappings, manifestText] = await Promise.all([
      "source/osm-stations.json", "mappings.json", "manifest.json",
    ].map((path) => readFile(new URL(path, root), "utf8")));
    assert.throws(() => buildRailDataset(raw! + " ", mappings!, manifestText!), /checksum/);
    assert.throws(() => buildRailDataset(raw!, mappings! + " ", manifestText!), /checksum/);
    for (const mutate of [
      (manifest: any) => { manifest.source.producer = "ONCF"; },
      (manifest: any) => { manifest.source.license = "Public-Domain"; },
      (manifest: any) => { manifest.record_count++; },
      (manifest: any) => { manifest.raw_record_count++; },
      (manifest: any) => { manifest.coverage.city++; },
      (manifest: any) => { manifest.warnings = []; },
      (manifest: any) => { manifest.merged = []; },
      (manifest: any) => { manifest.stations_sha256 = "0".repeat(64); },
      (manifest: any) => { manifest.transformation_version = "0.0.0"; },
    ]) {
      const manifest = JSON.parse(manifestText!); mutate(manifest);
      assert.throws(() => buildRailDataset(raw!, mappings!, JSON.stringify(manifest)));
    }
  });

  it("includes Rabat Riad and preserves the construction tag for the airport TGV project", async () => {
    const { records } = await loadRailDataset();
    assert.ok(records.some((s) => s.names.fr === "Gare Rabat Riad"));
    const airport = records.find((s) => s.id === "osm-node-14008729906")!;
    assert.equal(airport.osm_status, "construction");
    assert.equal(airport.sources.length, 2);
    const voyage = records.filter((s) => s.wikidata_id === "Q2448793");
    assert.equal(voyage.length, 1);
    assert.equal(voyage[0]!.sources.length, 3);
  });

  it("rejects invalid service claims, dates, coordinates and duplicated source identities", async () => {
    const { records, manifest } = await loadRailDataset();
    for (const mutate of [
      (row: any) => { row.passenger_service = true; },
      (row: any) => { row.connections = []; },
      (row: any) => { row.location.latitude = NaN; },
      (row: any) => { row.names.ar = ""; },
      (row: any) => { row.sources[0].updated_at = "2027-01-01T00:00:00Z"; },
      (row: any) => { row.sources.push(row.sources[0]); },
    ]) {
      const changed = structuredClone(records); mutate(changed[0]);
      assert.throws(() => validateStations(changed, manifest.record_count, manifest.source.snapshot_at));
    }
    assert.throws(() => validateStations(records.slice(1), manifest.record_count, manifest.source.snapshot_at), /count/);
  });
});
