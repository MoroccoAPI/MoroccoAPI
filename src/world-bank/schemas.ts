import { buildDatasetMeta } from "./metadata.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const year = { type: "integer", minimum: 1960, maximum: 2100 } as const;

const summaryProperties = {
  code: { type: "string", description: "World Bank indicator code, e.g. IT.NET.USER.ZS." },
  name: { type: "string" },
  topic_code: { type: "string", description: "Identifier of the topic group, as listed by /api/v1/world-bank/indicators/topics." },
  topic: { type: "string", description: "Full World Bank topic." },
  unit: { ...nullableString, description: "Unit of measure. Null when the World Bank metadata gives none; the unit is then only in the name." },
  periodicity: nullableString,
  license: { const: "CC-BY-4.0" },
  first_year: year,
  last_year: year,
  value_count: { type: "integer", minimum: 1 },
} as const;
const summaryRequired = Object.keys(summaryProperties);

export const indicatorSummarySchema = {
  type: "object", additionalProperties: false, required: summaryRequired, properties: summaryProperties,
} as const;

export const indicatorSchema = {
  type: "object", additionalProperties: false,
  required: [...summaryRequired, "source", "license_url", "citation_note", "definition", "values"],
  properties: {
    ...summaryProperties,
    source: { type: "string", description: "Original producer of the data, as credited by the World Bank." },
    license_url: { type: "string", format: "uri" },
    citation_note: { ...nullableString, description: "Attribution requested by the World Bank for third-party use, when any." },
    definition: nullableString,
    values: {
      type: "array",
      description: "Values for the requested years, oldest first. Years without a value are omitted.",
      items: {
        type: "object", additionalProperties: false, required: ["year", "value"],
        properties: { year, value: { type: "number" } },
      },
    },
  },
} as const;

export const topicSchema = {
  type: "object", additionalProperties: false, required: ["code", "name", "indicator_count"],
  properties: {
    code: { type: "string" },
    name: { type: "string" },
    indicator_count: { type: "integer", minimum: 1 },
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
    license: { const: "CC-BY-4.0" },
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

export function indicatorQuerySchema(topicCodes: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      q: {
        type: "string", minLength: 2, maxLength: 100,
        description: "Part of an indicator code or name (accent- and case-insensitive).",
      },
      topic: { type: "string", enum: topicCodes },
    },
  } as const;
}

export const valueRangeQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { ...year, description: "First year to include." },
    to: { ...year, description: "Last year to include." },
  },
} as const;

export const indicatorParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code"],
  properties: { code: { type: "string", minLength: 2, maxLength: 40, pattern: "^[A-Za-z0-9_.]+$" } },
} as const;
