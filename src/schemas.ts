export const regionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "type", "name"],
  properties: {
    code: { type: "string" },
    type: { const: "region" },
    name: {
      type: "object",
      additionalProperties: false,
      required: ["ar", "fr", "en"],
      properties: {
        ar: { type: "string" },
        fr: { type: "string" },
        en: { type: "string" },
      },
    },
  },
} as const;

const nullableSourceLanguageSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const;

const sourceLanguageNameSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ar", "fr", "en"],
  properties: {
    ar: nullableSourceLanguageSchema,
    fr: { type: "string" },
    en: nullableSourceLanguageSchema,
  },
} as const;

export const provinceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "type", "name", "region_code"],
  properties: {
    code: { type: "string" },
    type: { const: "province_or_prefecture" },
    name: sourceLanguageNameSchema,
    region_code: { type: "string" },
  },
} as const;

export const communeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "type", "name", "province_code", "region_code"],
  properties: {
    code: { type: "string" },
    type: { const: "commune" },
    name: sourceLanguageNameSchema,
    province_code: { type: "string" },
    region_code: { type: "string" },
  },
} as const;

const sourceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "dataset",
    "producer",
    "source_url",
    "resource_url",
    "license",
    "source_updated_at",
  ],
  properties: {
    dataset: { type: "string" },
    producer: { type: "string" },
    source_url: { type: "string", format: "uri" },
    resource_url: { type: "string", format: "uri" },
    license: { const: "ODbL-1.0" },
    source_updated_at: { type: "string", format: "date" },
  },
} as const;

export const datasetMetaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "dataset",
    "total",
    "license",
    "retrieved_at",
    "transformation_version",
    "sources",
  ],
  properties: {
    dataset: { const: "administrative-regions" },
    total: { type: "integer", minimum: 0 },
    license: { const: "ODbL-1.0" },
    retrieved_at: { type: "string", format: "date" },
    transformation_version: { const: "1.0.0" },
    sources: { type: "array", minItems: 1, items: sourceSchema },
  },
} as const;

export function pendingDatasetMetaSchema(
  dataset: "administrative-provinces" | "administrative-communes",
) {
  const pendingSourceSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "dataset",
      "producer",
      "source_url",
      "resource_url",
      "license",
      "source_updated_at",
    ],
    properties: {
      dataset: { type: "string" },
      producer: { const: "Haut-Commissariat au Plan (HCP)" },
      source_url: { type: "null" },
      resource_url: { type: "null" },
      license: { type: "null" },
      source_updated_at: { type: "null" },
    },
  } as const;

  return {
    type: "object",
    additionalProperties: false,
    required: [
      "dataset",
      "total",
      "license",
      "retrieved_at",
      "transformation_version",
      "sources",
      "review_status",
    ],
    properties: {
      dataset: { const: dataset },
      total: { type: "integer", minimum: 0 },
      license: { type: "null" },
      retrieved_at: { const: "2026-09-24" },
      transformation_version: { const: "1.0.0" },
      sources: { type: "array", minItems: 1, items: pendingSourceSchema },
      review_status: { const: "pending" },
    },
  } as const;
}

export const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "request_id"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        request_id: { type: "string" },
      },
    },
  },
} as const;
