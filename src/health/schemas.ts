import { hospitalCategories, primaryCareCategories } from "./categories.js";

import { buildDatasetMeta } from "./metadata.js";
import type { DatasetMeta } from "./types.js";
import { privateInfrastructureIndicators } from "./indicators.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const stringArray = { type: "array", items: { type: "string" } } as const;

export const hospitalSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "aliases", "category", "category_label", "ownership", "region_code", "province_code",
    "commune_code", "arrondissement_code", "reference_year", "location"],
  properties: {
    id: { type: "string" }, name: { type: "string" }, aliases: stringArray,
    category: nullableString, category_label: nullableString,
    ownership: { anyOf: [{ const: "public" }, { type: "null" }] },
    region_code: { type: "string" }, province_code: { type: "string" },
    commune_code: nullableString, arrondissement_code: nullableString,
    reference_year: { anyOf: [{ type: "integer" }, { type: "null" }] },
    location: { anyOf: [{ type: "null" }, {
      type: "object", additionalProperties: false, required: ["latitude", "longitude"],
      properties: {
        latitude: { type: "number", minimum: -90, maximum: 90 },
        longitude: { type: "number", minimum: -180, maximum: 180 },
      },
    }] },
  },
} as const;

export const primaryCareFacilitySchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "aliases", "category", "category_label", "ownership", "region_code", "province_code",
    "commune_code", "arrondissement_code", "reference_year", "last_service_event_date"],
  properties: {
    id: { type: "string" }, name: { type: "string" }, aliases: stringArray,
    category: { type: "string", enum: primaryCareCategories }, category_label: { type: "string" },
    ownership: { const: "public" },
    region_code: { type: "string" }, province_code: { type: "string" },
    commune_code: nullableString, arrondissement_code: nullableString,
    reference_year: { type: "integer", description: "Reference year of the national facility registry, not the retrieval year." },
    last_service_event_date: {
      description: "Matched official commissioning date after rehabilitation or equipment. Null means no matched announcement; it does not indicate closure or guarantee current operating status.",
      anyOf: [{ type: "string", format: "date" }, { type: "null" }],
    },
  },
} as const;

const sourceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "dataset", "producer", "source_url", "resource_url", "license", "source_updated_at",
  ],
  properties: {
    dataset: { type: "string" },
    producer: { type: "string" },
    source_url: { type: "string", format: "uri" },
    resource_url: { type: "string", format: "uri" },
    license: { enum: ["ODbL-1.0", "CC-BY-4.0"] },
    source_updated_at: { type: "string", format: "date" },
  },
} as const;

export const privateInfrastructureSchema = {
  type: "object", additionalProperties: false,
  required: ["geographic_level", "region_code", "reference_year", ...privateInfrastructureIndicators],
  properties: {
    geographic_level: { type: "string", enum: ["national", "region"] },
    region_code: { ...nullableString, description: "MoroccoAPI region code, or null for the national aggregate." },
    reference_year: { type: "integer", description: "Year described by the counts, not the publication or retrieval year." },
    ...Object.fromEntries(privateInfrastructureIndicators.map((field) => [field, {
      anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }],
      description: "Number of private establishments. Null means no published breakdown for this geographic level.",
    }])),
  },
} as const;

export function privateInfrastructureQuerySchema(regionCodes: readonly string[]) {
  return {
    type: "object", additionalProperties: false,
    properties: { region_code: { type: "string", enum: regionCodes } },
  } as const;
}

export function datasetMetaSchema(dataset: DatasetMeta["dataset"]) {
  const meta = buildDatasetMeta(dataset, 0);
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(meta),
    properties: {
      dataset: { const: dataset },
      total: { type: "integer", minimum: 0 },
      license: { const: meta.license },
      retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      sources: { type: "array", minItems: 1, items: sourceSchema },
    },
  } as const;
}

export function hospitalQuerySchema(regionCodes: readonly string[], provinceCodes: readonly string[]) {
  return facilityQuerySchema(regionCodes, provinceCodes, hospitalCategories);
}

export function primaryCareQuerySchema(regionCodes: readonly string[], provinceCodes: readonly string[]) {
  return facilityQuerySchema(regionCodes, provinceCodes, primaryCareCategories);
}

function facilityQuerySchema(regionCodes: readonly string[], provinceCodes: readonly string[], categories: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      region_code: { type: "string", enum: regionCodes },
      province_code: { type: "string", enum: provinceCodes },
      category: { type: "string", enum: categories },
      q: { type: "string", minLength: 2, maxLength: 100 },
    },
  } as const;
}

export function idParamsSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string", minLength: 1, maxLength: 100 } },
  } as const;
}
