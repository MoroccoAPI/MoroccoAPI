export const regionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "hcp_code", "type", "name"],
  properties: {
    code: { type: "string" },
    hcp_code: { type: "string", pattern: "^[0-9]{2}$" },
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
    ar: { type: "string" },
    fr: { type: "string" },
    en: nullableSourceLanguageSchema,
  },
} as const;

export const provinceSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "code",
    "hcp_code",
    "type",
    "administrative_type",
    "name",
    "region_code",
  ],
  properties: {
    code: { type: "string" },
    hcp_code: { type: "string", pattern: "^[0-9]{2}\\.[0-9]{3}$" },
    type: { const: "province_or_prefecture" },
    administrative_type: { enum: ["province", "prefecture"] },
    name: sourceLanguageNameSchema,
    region_code: { type: "string" },
  },
} as const;

export const communeSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "code",
    "hcp_code",
    "type",
    "name",
    "cercle_hcp_code",
    "province_code",
    "region_code",
  ],
  properties: {
    code: { type: "string" },
    hcp_code: {
      type: "string",
      pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}\\.[0-9]{1,2}$",
    },
    type: { const: "commune" },
    name: sourceLanguageNameSchema,
    cercle_hcp_code: {
      anyOf: [
        { type: "string", pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}$" },
        { type: "null" },
      ],
    },
    province_code: { type: "string" },
    region_code: { type: "string" },
  },
} as const;

export const prefectureOfArrondissementsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "hcp_code", "type", "name", "province_code", "region_code"],
  properties: {
    code: { type: "string" },
    hcp_code: {
      type: "string",
      pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}\\.[0-9]{2}$",
    },
    type: { const: "prefecture_of_arrondissements" },
    name: sourceLanguageNameSchema,
    province_code: { type: "string" },
    region_code: { type: "string" },
  },
} as const;

export const arrondissementSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "code",
    "hcp_code",
    "type",
    "name",
    "commune_code",
    "prefecture_of_arrondissements_code",
    "province_code",
    "region_code",
  ],
  properties: {
    code: { type: "string" },
    hcp_code: {
      type: "string",
      pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}\\.[0-9]{2}$",
    },
    type: { const: "arrondissement" },
    name: sourceLanguageNameSchema,
    commune_code: { type: "string" },
    prefecture_of_arrondissements_code: {
      anyOf: [
        { type: "string", pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" },
        { type: "null" },
      ],
    },
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
    license: { const: "CC-BY-4.0" },
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
      license: { const: "CC-BY-4.0" },
      retrieved_at: { const: "2026-09-25" },
      transformation_version: { const: "2.0.0" },
    sources: { type: "array", minItems: 1, items: sourceSchema },
  },
} as const;

export function geographyDatasetMetaSchema(
  dataset:
    | "administrative-provinces"
    | "administrative-prefectures-of-arrondissements"
    | "administrative-communes"
    | "administrative-arrondissements",
) {
  const hcpSourceSchema = {
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
      source_url: { type: "string", format: "uri" },
      resource_url: { type: "string", format: "uri" },
      license: { const: "CC-BY-4.0" },
      source_updated_at: { const: "2024-11-22" },
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
    ],
    properties: {
      dataset: { const: dataset },
      total: { type: "integer", minimum: 0 },
      license: { const: "CC-BY-4.0" },
      retrieved_at: { const: "2026-09-26" },
      transformation_version: { const: "3.0.0" },
      sources: { type: "array", minItems: 1, items: hcpSourceSchema },
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
