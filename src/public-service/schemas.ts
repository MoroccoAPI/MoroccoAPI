import { buildDatasetMeta } from "./metadata.js";

export { errorSchema, responseSchema } from "../common/schemas.js";

export const gradeSalarySchema = {
  type: "object",
  additionalProperties: false,
  required: ["code", "grade", "corps", "net_monthly_salary_mad", "reference_url"],
  properties: {
    code: { type: "string", pattern: "^[a-z0-9-]+$" },
    grade: {
      type: "object",
      additionalProperties: false,
      required: ["fr"],
      properties: { fr: { type: "string" } },
    },
    corps: {
      type: "object",
      additionalProperties: false,
      required: ["ar"],
      properties: { ar: { type: "string" } },
    },
    net_monthly_salary_mad: { type: "integer", minimum: 1 },
    reference_url: { type: "string", format: "uri" },
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
    required: [
      "dataset",
      "total",
      "license",
      "retrieved_at",
      "transformation_version",
      "value_type",
      "notice",
      "sources",
    ],
    properties: {
      dataset: { const: meta.dataset },
      total: { type: "integer", minimum: 0 },
      license: { const: meta.license },
      retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      value_type: { const: meta.value_type },
      notice: { const: meta.notice },
      sources: { type: "array", minItems: 1, items: sourceSchema },
    },
  } as const;
}
