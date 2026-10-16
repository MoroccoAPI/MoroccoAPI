import { buildDatasetMeta } from "./metadata.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const postalCode = { type: "string", pattern: "^[0-9]{5}$" } as const;

export const postalPlaceTypes = ["locality", "neighborhood"] as const;

export const postalCodeSchema = {
  type: "object", additionalProperties: false,
  required: ["postal_code", "type", "name", "city", "province_code", "region_code", "commune_code"],
  properties: {
    postal_code: postalCode,
    type: {
      type: "string", enum: postalPlaceTypes,
      description: "locality: a place outside the multi-code cities, with one code. neighborhood: a neighbourhood of a multi-code city.",
    },
    name: { type: "string", description: "Poste Maroc spelling, preserved apart from whitespace." },
    city: { ...nullableString, description: "Multi-code city of a neighborhood, or null for a locality." },
    province_code: { type: "string" },
    region_code: { type: "string" },
    commune_code: {
      ...nullableString,
      description: "MoroccoAPI commune whose name equals the locality name in the same province. Null when there is no exact match, and always null for neighborhoods.",
    },
  },
} as const;

export const multiCodeCitySchema = {
  type: "object", additionalProperties: false,
  required: ["name", "province_code", "region_code", "commune_code", "postal_codes", "neighborhood_count"],
  properties: {
    name: { type: "string", description: "Poste Maroc spelling of the city." },
    province_code: { type: "string" },
    region_code: { type: "string" },
    commune_code: nullableString,
    postal_codes: { type: "array", items: postalCode, minItems: 1 },
    neighborhood_count: { type: "integer", minimum: 1 },
  },
} as const;

const sourceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
  properties: {
    dataset: { type: "string" },
    producer: { type: "string" },
    source_url: { type: "string", format: "uri" },
    resource_url: { type: "string", format: "uri" },
    license: { enum: ["ODbL-1.0", "CC-BY-4.0"] },
    source_updated_at: { type: "string", format: "date" },
  },
} as const;

export function datasetMetaSchema() {
  const meta = buildDatasetMeta(0);
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(meta),
    properties: {
      dataset: { const: meta.dataset },
      total: { type: "integer", minimum: 0 },
      license: { const: meta.license },
      retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      sources: { type: "array", minItems: 1, items: sourceSchema },
    },
  } as const;
}

export function postalCodeQuerySchema(regionCodes: readonly string[], provinceCodes: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      q: {
        type: "string", minLength: 2, maxLength: 100,
        description: "Place or city name (accent- and case-insensitive), or the first digits of a postal code.",
      },
      type: { type: "string", enum: postalPlaceTypes },
      region_code: { type: "string", enum: regionCodes },
      province_code: { type: "string", enum: provinceCodes },
      city: {
        type: "string", minLength: 2, maxLength: 100,
        description: "Multi-code city name from /api/v1/postal-codes/cities; case, accents, spaces and hyphens are ignored.",
      },
    },
  } as const;
}

export const postalCodeParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code"],
  properties: { code: postalCode },
} as const;
