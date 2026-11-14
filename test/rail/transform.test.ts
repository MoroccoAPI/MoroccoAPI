import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { transformStations } from "../../src/rail/data/transform.js";
import type { RawElement, RawSnapshot, StationMappings } from "../../src/rail/types.js";

const source: RawSnapshot["source"] = {
  id: "test", producer: "OpenStreetMap contributors", source_url: "https://example.org/",
  resource_url: "https://example.org/source.pbf", snapshot_at: "2026-11-13T21:22:20Z",
  replication_sequence: null, retrieved_at: "2026-11-14", pbf_sha256: "a".repeat(64), pbf_size_bytes: 1,
  license: "ODbL-1.0", license_url: "https://opendatacommons.org/licenses/odbl/1-0/", attribution: "© OpenStreetMap contributors",
};
const element = (id: number, tags: Record<string, string> = {}): RawElement => ({
  type: "node", id, version: 1, timestamp: "2026-10-01T00:00:00Z",
  tags: { railway: "station", ...tags }, geometry: { type: "Point", coordinates: [-6.8, 34] },
});
const convert = (elements: RawElement[], mappings: StationMappings = { merges: [] }) => transformStations({ source, elements }, mappings);

describe("Rail source transformation", () => {
  it("keeps uncertainty, explicit translations and source field provenance", () => {
    const station = convert([element(1, { name: "Rabat", "name:ar": "الرباط", train: "yes" })]).stations[0]!;
    assert.equal(station.names.ar, "الرباط");
    assert.equal(station.names.fr, null, "A Latin name is not automatically a French translation");
    assert.equal(station.city, null, "Do not infer a municipality from the station name");
    assert.equal(station.operator, null);
    assert.equal(station.passenger_service, null, "train=yes identifies mode, not current service");
    assert.equal(station.connections, null);
    assert.equal(station.osm_status, "unknown");
    assert.ok(station.sources[0]!.fields.includes("names.ar"));
    assert.ok(!station.sources[0]!.fields.includes("city"));
  });

  it("classifies lifecycle prefixes and removes explicitly non-train stations", () => {
    const result = convert([
      element(1, { "disused:railway": "station" }), element(2, { railway: "halt" }),
      element(3, { railway: "construction", "construction:railway": "station" }),
      element(4, { station: "subway" }), element(5, { tram: "yes" }),
      element(6, { "abandoned:railway": "station" }), element(7, { railway: "platform" }),
      element(8, { "razed:railway": "station" }),
    ]);
    assert.deepEqual(result.stations.map((s) => [s.id, s.type, s.osm_status]), [
      ["osm-node-1", "station", "disused"], ["osm-node-2", "halt", "unknown"],
      ["osm-node-3", "station", "construction"], ["osm-node-6", "station", "abandoned"],
      ["osm-node-8", "station", "demolished"],
    ]);
    assert.deepEqual(result.excluded.map((e) => e.id), ["osm-node-4", "osm-node-5", "osm-node-7"]);
  });

  it("marks derived polygon coordinates and explicitly reports missing geometry", () => {
    const way = { ...element(1), type: "way" as const,
      geometry: { type: "Polygon", coordinates: [[[-7, 33], [-6, 33], [-6, 34], [-7, 33]]] } };
    const result = convert([way, { ...element(2), geometry: null }]);
    assert.deepEqual(result.stations[0]!.location, { latitude: 33.5, longitude: -6.5, method: "bounding_box_center" });
    assert.equal(result.excluded[0]!.reason, "missing_geometry");
  });

  it("does not apply a former station's lifecycle to a differently classified current halt", () => {
    const result = convert([element(1, { railway: "halt", "disused:railway": "station" })]);
    assert.equal(result.stations[0]!.type, "halt");
    assert.equal(result.stations[0]!.osm_status, "unknown");
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0]!.reason, /conflicts/);
  });

  it("merges only reviewed representations and retains aliases and contributed fields", () => {
    const first = element(1, { name: "Agdal" });
    const second = element(2, { name: "Gare Agdal", "name:ar": "أكدال", "addr:city": "الرباط" });
    assert.equal(convert([first, second]).stations.length, 2, "Proximity alone never merges records");
    const mappings = { merges: [{ primary: "osm-node-1", members: ["osm-node-2"], reason: "Reviewed same station" }] };
    const result = convert([first, second], mappings).stations[0]!;
    assert.equal(result.id, "osm-node-1");
    assert.equal(result.city, "الرباط");
    assert.equal(result.names.ar, "أكدال");
    assert.ok(result.aliases.includes("Gare Agdal"));
    assert.ok(result.sources[1]!.fields.includes("city"));
    assert.equal(result.sources.length, 2);
    assert.throws(() => convert([first], mappings), /needs review/);
  });

  it("never loses an explicit construction status when a duplicate is merely unknown", () => {
    const primary = element(1, { "construction:railway": "station" });
    const secondary = element(2);
    const mappings = { merges: [{ primary: "osm-node-1", members: ["osm-node-2"], reason: "Reviewed construction duplicate" }] };
    assert.equal(convert([primary, secondary], mappings).stations[0]!.osm_status, "construction");
    assert.throws(() => convert([secondary, primary], { merges: [{ ...mappings.merges[0]!, primary: "osm-node-2", members: ["osm-node-1"] }] }), /needs review/);
    assert.throws(() => convert([primary, element(2, { "abandoned:railway": "station" })], mappings), /needs review/);
  });

  it("fails review when a mapped duplicate moves far away or has a conflicting Wikidata identity", () => {
    const mappings = { merges: [{ primary: "osm-node-1", members: ["osm-node-2"], reason: "Reviewed" }] };
    assert.throws(() => convert([element(1), { ...element(2), geometry: { type: "Point", coordinates: [-7.5, 33.5] } }], mappings), /needs review/);
    assert.throws(() => convert([element(1, { wikidata: "Q1" }), element(2, { wikidata: "Q2" })], mappings), /needs review/);
  });

  it("rejects malformed coordinates, duplicate identities and future-dated edits", () => {
    assert.throws(() => convert([element(1), element(1)]), /Duplicate OSM/);
    assert.throws(() => convert([{ ...element(1), geometry: { type: "Point", coordinates: [NaN, 34] } }]), /Invalid coordinates/);
    assert.throws(() => convert([{ ...element(1), timestamp: "2027-01-01T00:00:00Z" }]), /Invalid OSM/);
  });
});
