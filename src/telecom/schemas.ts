import type { DatasetMeta } from "./types.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nullValue = { type: "null" } as const;
const prefix = { type: "string", minLength: 2, maxLength: 6, pattern: "^0[5-8][0-9]{0,4}$" } as const;
const operatorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "name"],
  properties: { code: { type: "string" }, name: { type: "string" } },
} as const;
export const areaCodeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "international_prefix", "description", "areas", "hcp_code"],
  properties: {
    code: prefix,
    international_prefix: { type: "string" },
    description: {
      type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
      properties: { ar: nullValue, fr: { type: "string" }, en: { type: "string" } },
    },
    areas: {
      type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
      properties: {
        ar: nullValue,
        fr: { type: "array", items: { type: "string" } },
        en: { type: "array", items: { type: "string" } },
      },
    },
    hcp_code: nullValue,
  },
} as const;

export const numberingRangeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["prefix", "international_prefix", "mask", "category", "original_operator", "area_code", "more_specific_prefixes"],
  properties: {
    prefix,
    international_prefix: { type: "string" },
    mask: { type: "string", pattern: "^0[0-9]+X+$" },
    category: { enum: ["carrier", "geographic"] },
    original_operator: { anyOf: [operatorSchema, nullValue] },
    area_code: nullableString,
    more_specific_prefixes: { type: "array", items: prefix },
  },
} as const;

export const numberValidationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["is_possible", "is_valid_format", "is_allocated_range", "has_known_prefix", "e164", "national_number", "number_type", "reason"],
  properties: {
    is_possible: { type: "boolean", description: "Length compatibility with the numbering plan." },
    is_valid_format: { type: "boolean", description: "Validity against the pinned parser metadata; does not prove line assignment or reachability." },
    is_allocated_range: { ...nullValue, description: "Unknown: the prefix mapping dataset is not an official allocation registry." },
    has_known_prefix: { type: "boolean", description: "A prefix mapping exists, independently of format validity." },
    e164: nullableString,
    national_number: nullableString,
    number_type: nullableString,
    reason: { anyOf: [{ enum: ["INVALID_CHARACTERS", "INVALID_LENGTH", "NOT_MOROCCAN", "INVALID_NUMBER_PATTERN"] }, nullValue] },
  },
} as const;

export const numberLookupSchema = {
  ...numberValidationSchema,
  required: [...numberValidationSchema.required, "matched_prefix", "original_operator", "current_operator", "geographic_area"],
  properties: {
    ...numberValidationSchema.properties,
    matched_prefix: nullableString,
    original_operator: { anyOf: [operatorSchema, nullValue] },
    current_operator: { ...nullValue, description: "Cannot be inferred from a prefix after number portability." },
    geographic_area: { anyOf: [areaCodeSchema, nullValue] },
  },
} as const;

export function datasetMetaSchema(dataset: DatasetMeta["dataset"]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["dataset", "total", "license", "retrieved_at", "transformation_version", "sources"],
    properties: {
      dataset: { const: dataset },
      total: { type: "integer", minimum: 0 },
      license: { const: "Apache-2.0" },
      retrieved_at: { type: "string", format: "date" },
      transformation_version: { type: "string" },
      sources: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
          properties: {
            dataset: { type: "string" },
            producer: { type: "string" },
            source_url: { type: "string", format: "uri" },
            resource_url: { type: "string", format: "uri" },
            license: { const: "Apache-2.0" },
            source_updated_at: nullableString,
          },
        },
      },
    },
  } as const;
}

export const numberQuerySchema = {
  type: "object", additionalProperties: false, required: ["number"],
  properties: { number: { type: "string", minLength: 1, maxLength: 64, description: "Moroccan national, nine-digit significant, +212 or 00212 form. Percent-encode a leading plus as %2B." } },
} as const;

export const prefixQuerySchema = {
  type: "object", additionalProperties: false,
  properties: { prefix },
} as const;

export const rangeQuerySchema = {
  ...prefixQuerySchema,
  properties: {
    prefix,
    category: { enum: ["carrier", "geographic"] },
    operator: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-z]+(?:-[a-z]+)*$" },
  },
} as const;

export const prefixParamsSchema = {
  type: "object", additionalProperties: false, required: ["prefix"], properties: { prefix },
} as const;
export const areaParamsSchema = {
  type: "object", additionalProperties: false, required: ["code"], properties: { code: prefix },
} as const;
