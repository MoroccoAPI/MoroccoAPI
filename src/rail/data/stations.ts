import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { stationStatuses, stationTypes, type RawSnapshot, type Station, type StationManifest, type StationMappings } from "../types.js";
import { transformStations, TRANSFORMATION_VERSION } from "./transform.js";

const root = new URL("../../../data/rail/", import.meta.url);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const nullableText = (value: unknown) => value === null || text(value);
const isoTime = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function validateStations(parsed: unknown, expectedCount: number, snapshotAt: string): readonly Station[] {
  if (!Array.isArray(parsed) || parsed.length !== expectedCount || !parsed.length || !isoTime(snapshotAt)) {
    throw new Error("Rail station count or snapshot timestamp mismatch");
  }
  const ids = new Set<string>();
  const sourceIds = new Set<string>();
  const records = parsed.map((row: unknown): Station => {
    if (!isObject(row) || !text(row.id) || !/^osm-(node|way|relation)-[1-9]\d*$/.test(row.id) ||
      !nullableText(row.name) || !isObject(row.names) ||
      ![row.names.ar, row.names.fr, row.names.en].every(nullableText) || !stringArray(row.aliases) ||
      !stationTypes.includes(row.type as Station["type"]) || !stationStatuses.includes(row.osm_status as Station["osm_status"]) ||
      ![row.city, row.operator, row.network].every(nullableText) ||
      !(row.wikidata_id === null || typeof row.wikidata_id === "string" && /^Q[1-9]\d*$/.test(row.wikidata_id)) ||
      row.passenger_service !== null || row.connections !== null ||
      !Array.isArray(row.sources) || !row.sources.length) throw new Error("Invalid rail station record");
    if (!isObject(row.location) || typeof row.location.latitude !== "number" || !Number.isFinite(row.location.latitude) ||
      Math.abs(row.location.latitude) > 90 || typeof row.location.longitude !== "number" ||
      !Number.isFinite(row.location.longitude) || Math.abs(row.location.longitude) > 180 ||
      !["osm_point", "bounding_box_center"].includes(String(row.location.method))) throw new Error(`Invalid rail coordinates: ${row.id}`);
    if (ids.has(row.id)) throw new Error(`Duplicate rail station: ${row.id}`);
    ids.add(row.id);
    row.sources.forEach((source: unknown, index: number) => {
      if (!isObject(source) || !["node", "way", "relation"].includes(String(source.osm_type)) ||
        !Number.isSafeInteger(source.osm_id) || Number(source.osm_id) < 1 ||
        !Number.isSafeInteger(source.version) || Number(source.version) < 1 ||
        !isoTime(source.updated_at) || Date.parse(source.updated_at) > Date.parse(snapshotAt) ||
        source.url !== `https://www.openstreetmap.org/${source.osm_type}/${source.osm_id}` ||
        !stringArray(source.fields)) throw new Error(`Invalid rail source: ${row.id}`);
      const id = `osm-${source.osm_type}-${source.osm_id}`;
      if (index === 0 && id !== row.id || sourceIds.has(id)) throw new Error(`Duplicate or inconsistent rail source: ${id}`);
      sourceIds.add(id);
    });
    return freeze(structuredClone(row) as unknown as Station);
  });
  return Object.freeze(records);
}

/** Build the immutable directory from the reviewed source and mappings at startup. */
export function buildRailDataset(rawText: string, mappingsText: string, manifestText: string): { records: readonly Station[]; manifest: StationManifest } {
  const manifest: StationManifest = JSON.parse(manifestText);
  if (!manifest?.source || manifest.source.license !== "ODbL-1.0" || !isoTime(manifest.source.snapshot_at) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(manifest.source.retrieved_at) ||
    manifest.source.retrieved_at < manifest.source.snapshot_at.slice(0, 10) ||
    manifest.transformation_version !== TRANSFORMATION_VERSION ||
    !Number.isSafeInteger(manifest.record_count) || manifest.record_count < 1 || !Number.isSafeInteger(manifest.raw_record_count) ||
    manifest.raw_record_count < manifest.record_count ||
    !/^[a-f0-9]{64}$/.test(manifest.source.pbf_sha256) ||
    digest(rawText) !== manifest.raw_sha256 || digest(mappingsText) !== manifest.mappings_sha256) {
    throw new Error("Rail source checksum or manifest is invalid");
  }
  const raw: RawSnapshot = JSON.parse(rawText);
  const mappings: StationMappings = JSON.parse(mappingsText);
  const result = transformStations(raw, mappings);
  if (!isDeepStrictEqual(raw.source, manifest.source) || raw.elements.length !== manifest.raw_record_count ||
    !isDeepStrictEqual(result.excluded, manifest.excluded) || !isDeepStrictEqual(result.warnings, manifest.warnings) ||
    !isDeepStrictEqual(result.coverage, manifest.coverage) || !isDeepStrictEqual(mappings.merges, manifest.merged) ||
    digest(JSON.stringify(result.stations, null, 2) + "\n") !== manifest.stations_sha256) {
    throw new Error("Rail transformation differs from the reviewed manifest");
  }
  return { records: validateStations(result.stations, manifest.record_count, manifest.source.snapshot_at), manifest: freeze(manifest) };
}

export async function loadRailDataset(): Promise<{ records: readonly Station[]; manifest: StationManifest }> {
  const [raw, mappings, manifest] = await Promise.all([
    readFile(new URL("source/osm-stations.json", root), "utf8"),
    readFile(new URL("mappings.json", root), "utf8"),
    readFile(new URL("manifest.json", root), "utf8"),
  ]);
  return buildRailDataset(raw, mappings, manifest);
}
