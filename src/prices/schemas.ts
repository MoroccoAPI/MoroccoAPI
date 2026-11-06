import { buildDatasetMeta } from "./metadata.js";
import { PRODUCT_LEVELS } from "./types.js";

const month = { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" } as const;
const productCode = { type: "string", description: "HCP product code: GR for the general index, then 2, 3 or 4 digits." } as const;
const level = {
  enum: PRODUCT_LEVELS,
  description: "general (all products), division (2-digit code), group (3 digits) or class (4 digits).",
} as const;

const cityProperties = {
  code: { type: "string", description: "MoroccoAPI city code; national is the index for Morocco as a whole." },
  name: { type: "string", description: "City label as published by HCP." },
  region_code: {
    anyOf: [{ type: "string" }, { type: "null" }],
    description: "Region where the city is located; null for the national index.",
  },
  product_count: { type: "integer", minimum: 1, description: "Number of products with an index for this city." },
  first_month: { ...month, description: "First published month." },
  last_month: { ...month, description: "Last published month." },
} as const;

export const citySchema = {
  type: "object", additionalProperties: false, required: Object.keys(cityProperties), properties: cityProperties,
} as const;

const productProperties = {
  code: productCode,
  name: { type: "string", description: "Product label as published by HCP, in French, including its spelling and capitalisation." },
  level,
  parent_code: {
    anyOf: [productCode, { type: "null" }],
    description: "Code of the product one level up; null for the general index.",
  },
  city_count: {
    type: "integer", minimum: 0, maximum: 18,
    description: "Number of the 18 cities with an index for this product. The national index covers every product.",
  },
} as const;

export const productSchema = {
  type: "object", additionalProperties: false, required: Object.keys(productProperties), properties: productProperties,
} as const;

const observationProperties = {
  city_code: cityProperties.code,
  product_code: productCode,
  product_name: productProperties.name,
  level,
  month: { ...month, description: "Month of the observation, YYYY-MM." },
  index: { type: "number", minimum: 0, description: "Consumer price index for the month, base 100 = average of 2017." },
} as const;

export const observationSchema = {
  type: "object", additionalProperties: false, required: Object.keys(observationProperties), properties: observationProperties,
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
    license: { const: "ODbL-1.0" },
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

export function cpiQuerySchema(cityCodes: readonly string[], productCodes: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      city: { type: "string", enum: cityCodes, description: "City code from /api/v2/prices/cpi/cities. Give city, product or both." },
      product: { type: "string", enum: productCodes, description: "Product code from /api/v2/prices/cpi/products. Give city, product or both." },
      level,
      from: { ...month, description: "First month to include, YYYY-MM." },
      to: { ...month, description: "Last month to include, YYYY-MM." },
    },
  } as const;
}

export const productQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { level },
} as const;
