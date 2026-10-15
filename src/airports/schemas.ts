import { buildDatasetMeta } from "./metadata.js";
import { airportTypes } from "./types.js";

const string = { type: "string", minLength: 1 } as const;
const nullableString = { anyOf: [string, { type: "null" }] } as const;

export const airportSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "ident", "icao_code", "iata_code", "name", "type", "municipality", "iso_country", "iso_region", "location", "scheduled_service"],
  properties: {
    id: { type: "integer", minimum: 1, description: "Persistent OurAirports numeric ID, retained when codes change." },
    ident: { ...string, description: "OurAirports identifier; it is not necessarily an ICAO code." },
    icao_code: { anyOf: [{ type: "string", pattern: "^[A-Z]{4}$" }, { type: "null" }], description: "Explicit source ICAO field; never inferred from ident or GPS." },
    iata_code: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] },
    name: string, type: { type: "string", enum: airportTypes },
    municipality: { ...nullableString, description: "Source municipality served, not necessarily the airport's physical municipality." },
    iso_country: { const: "MA" }, iso_region: nullableString,
    location: { anyOf: [{ type: "null" }, {
      type: "object", additionalProperties: false, required: ["latitude", "longitude"],
      properties: {
        latitude: { type: "number", minimum: -90, maximum: 90 },
        longitude: { type: "number", minimum: -180, maximum: 180 },
      },
    }] },
    scheduled_service: { type: "boolean", description: "OurAirports scheduled airline service flag at the snapshot; not a live availability guarantee." },
  },
} as const;

export const airportQuerySchema = {
  type: "object", additionalProperties: false,
  properties: {
    q: { type: "string", minLength: 2, maxLength: 100, description: "Search names, source municipality, IATA and explicit ICAO codes without case or accent distinctions." },
    city: { type: "string", minLength: 2, maxLength: 100, description: "Exact source municipality match, ignoring case and accents." },
    type: { type: "string", enum: airportTypes },
    scheduled_service: { type: "boolean" },
  },
} as const;

export const airportParamsSchema = {
  type: "object", additionalProperties: false, required: ["icao"],
  properties: { icao: { type: "string", pattern: "^[A-Za-z]{4}$" } },
} as const;

const meta = buildDatasetMeta(0);
export const datasetMetaSchema = {
  type: "object", additionalProperties: false, required: Object.keys(meta),
  properties: {
    dataset: { const: meta.dataset }, total: { type: "integer", minimum: 0 },
    license: { const: meta.license }, license_url: { const: meta.license_url },
    retrieved_at: { const: meta.retrieved_at }, transformation_version: { const: meta.transformation_version },
    snapshot_date: { const: meta.snapshot_date }, source_revision: { const: meta.source_revision },
    source_record_count: { const: meta.source_record_count }, scope: string,
    limitations: { type: "array", items: string },
    sources: { type: "array", minItems: 1, items: {
      type: "object", additionalProperties: false,
      required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
      properties: {
        dataset: string, producer: string, source_url: { type: "string", format: "uri" },
        resource_url: { type: "string", format: "uri" }, license: { const: meta.license },
        source_updated_at: { type: "string", format: "date" },
      },
    } },
  },
} as const;
