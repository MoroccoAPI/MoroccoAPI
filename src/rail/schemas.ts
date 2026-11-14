import { buildDatasetMeta } from "./metadata.js";
import { stationStatuses, stationTypes, type StationManifest } from "./types.js";

const string = { type: "string", minLength: 1 } as const;
const nullableString = { anyOf: [string, { type: "null" }] } as const;
const sourceSchema = {
  type: "object", additionalProperties: false,
  required: ["osm_type", "osm_id", "version", "updated_at", "url", "fields"],
  properties: {
    osm_type: { type: "string", enum: ["node", "way", "relation"] },
    osm_id: { type: "integer", minimum: 1 }, version: { type: "integer", minimum: 1 },
    updated_at: { type: "string", format: "date-time", description: "OSM edit timestamp, not a verification of current service." },
    url: { type: "string", format: "uri" }, fields: { type: "array", items: string },
  },
} as const;

export const stationSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "names", "aliases", "type", "city", "operator", "network", "location", "osm_status", "wikidata_id", "passenger_service", "connections", "sources"],
  properties: {
    id: { type: "string", pattern: "^osm-(node|way|relation)-[1-9][0-9]*$" }, name: nullableString,
    names: { type: "object", additionalProperties: false, required: ["ar", "fr", "en"], properties: { ar: nullableString, fr: nullableString, en: nullableString } },
    aliases: { type: "array", items: string }, type: { type: "string", enum: stationTypes },
    city: { ...nullableString, description: "Explicit OSM addr:city or is_in:city, not a geocoded administrative assignment." },
    operator: nullableString, network: nullableString,
    location: { type: "object", additionalProperties: false, required: ["latitude", "longitude", "method"], properties: {
      latitude: { type: "number", minimum: -90, maximum: 90 }, longitude: { type: "number", minimum: -180, maximum: 180 },
      method: { type: "string", enum: ["osm_point", "bounding_box_center"] },
    } },
    osm_status: { type: "string", enum: stationStatuses, description: "Explicit source lifecycle only; unknown is not confirmation of current service." },
    wikidata_id: { anyOf: [{ type: "string", pattern: "^Q[1-9][0-9]*$" }, { type: "null" }] },
    passenger_service: { type: "null", description: "Current passenger service is not verified." },
    connections: { type: "null", description: "Unavailable, not an empty set of connections. No timetable feed is integrated." },
    sources: { type: "array", minItems: 1, items: sourceSchema },
  },
} as const;

export const stationQuerySchema = {
  type: "object", additionalProperties: false,
  properties: {
    q: { type: "string", minLength: 2, maxLength: 100, description: "Search source names, aliases, city, OSM ID and Wikidata ID; accent- and case-insensitive." },
    city: { type: "string", minLength: 2, maxLength: 100, description: "Exact explicit source city; incomplete coverage. Case and accents ignored." },
    type: { type: "string", enum: stationTypes }, status: { type: "string", enum: stationStatuses },
  },
} as const;
export const stationParamsSchema = {
  type: "object", additionalProperties: false, required: ["id"],
  properties: { id: { type: "string", maxLength: 40, pattern: "^osm-(node|way|relation)-[1-9][0-9]*$" } },
} as const;

export function stationMetaSchema(manifest: StationManifest) {
  const meta = buildDatasetMeta(manifest, 0);
  return {
    type: "object", additionalProperties: false, required: Object.keys(meta),
    properties: {
      dataset: { const: meta.dataset }, total: { type: "integer", minimum: 0 },
      license: { const: meta.license }, license_url: { const: meta.license_url }, attribution: { const: meta.attribution },
      snapshot_at: { const: meta.snapshot_at }, retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      source_record_count: { const: meta.source_record_count }, snapshot_record_count: { const: meta.snapshot_record_count },
      scope: string, limitations: { type: "array", items: string },
      sources: { type: "array", minItems: 1, items: {
        type: "object", additionalProperties: false,
        required: ["producer", "source_url", "resource_url", "license", "source_updated_at", "sha256"],
        properties: { producer: string, source_url: { type: "string", format: "uri" }, resource_url: { type: "string", format: "uri" },
          license: { const: meta.license }, source_updated_at: { type: "string", format: "date-time" }, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" } },
      } },
    },
  } as const;
}
