import { buildDatasetMeta } from "./metadata.js";
import type { DatasetMeta } from "./types.js";

export const nationalPopulationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["total", "moroccans", "foreigners", "urban", "rural"],
  properties: {
    total: { type: "integer", minimum: 0 },
    moroccans: { type: "integer", minimum: 0 },
    foreigners: { type: "integer", minimum: 0 },
    urban: {
      type: "object",
      additionalProperties: false,
      required: ["total", "moroccans", "foreigners"],
      properties: {
        total: { type: "integer", minimum: 0 },
        moroccans: { type: "integer", minimum: 0 },
        foreigners: { type: "integer", minimum: 0 },
      },
    },
    rural: {
      type: "object",
      additionalProperties: false,
      required: ["total", "moroccans", "foreigners"],
      properties: {
        total: { type: "integer", minimum: 0 },
        moroccans: { type: "integer", minimum: 0 },
        foreigners: { type: "integer", minimum: 0 },
      },
    },
  },
};

export const regionPopulationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "code",
    "hcp_code",
    "type",
    "name",
    "population",
    "moroccans",
    "foreigners",
    "urban",
    "rural",
  ],
  properties: {
    code: { type: "string"},
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
    population: { type: "integer", minimum: 0 },
    moroccans: { type: "integer", minimum: 0 },
    foreigners: { type: "integer", minimum: 0 },
    urban: { type: "integer", minimum: 0 },
    rural: { type: "integer", minimum: 0 },
  },
} as const;

export const historicalPopulationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["year", "total", "urban", "rural"],
  properties: {
    year: { type: "integer", minimum: 0 },
    total: { type: "integer", minimum: 0 },
    urban: { type: "integer", minimum: 0 },
    rural: { type: "integer", minimum: 0 },
  },
} as const;

export const subdivisionPopulationSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "code",
    "hcp_code",
    "type",
    "administrative_type",
    "name",
    "region_code",
    "population",
    "moroccans",
    "foreigners",
    "households",
  ],
  properties: {
    code: { type: "string", pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" },
    hcp_code: { type: "string", pattern: "^[0-9]{2}\\.[0-9]{3}$" },
    type: { const: "province_or_prefecture" },
    administrative_type: { enum: ["province", "prefecture"] },
    name: {
      type: "object",
      additionalProperties: false,
      required: ["ar", "fr", "en"],
      properties: {
        ar: { type: "string" },
        fr: { type: "string" },
        en: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    },
    region_code: { type: "string" },
    population: { type: "integer", minimum: 0 },
    moroccans: { type: "integer", minimum: 0 },
    foreigners: { type: "integer", minimum: 0 },
    households: { type: "integer", minimum: 0 },
  },
} as const;

export const communePopulationSchema = {
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
    "population",
    "moroccans",
    "foreigners",
    "households",
  ],
  properties: {
    code: { type: "string", pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" },
    hcp_code: {
      type: "string",
      pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}\\.[0-9]{1,2}$",
    },
    type: { const: "commune" },
    name: {
      type: "object",
      additionalProperties: false,
      required: ["ar", "fr", "en"],
      properties: {
        ar: { type: "string" },
        fr: { type: "string" },
        en: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
    },
    cercle_hcp_code: {
      anyOf: [
        { type: "string", pattern: "^[0-9]{2}\\.[0-9]{3}\\.[0-9]{2}$" },
        { type: "null" },
      ],
    },
    province_code: { type: "string" },
    region_code: { type: "string" },
    population: { type: "integer", minimum: 0 },
    moroccans: { type: "integer", minimum: 0 },
    foreigners: { type: "integer", minimum: 0 },
    households: { type: "integer", minimum: 0 },
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

export function datasetMetaSchema(dataset: DatasetMeta["dataset"]) {
  const meta = buildDatasetMeta(dataset, 0);
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
      license: { const: meta.license },
      retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      sources: { type: "array", minItems: 1, items: sourceSchema },
    },
  } as const;
}

export function responseSchema(
  data: Record<string, unknown>,
  meta: Record<string, unknown>,
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["data", "meta"],
    properties: { data, meta },
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
