import { buildLabourDatasetMeta } from "./metadata.js";
import { LABOUR_AREAS } from "./types.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const rate = (description: string) => ({ anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }], description });
const slug = { type: "string", minLength: 2, maxLength: 180, pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" } as const;
const year = { type: "integer", minimum: 2000, maximum: 2100 } as const;

const observationProperties = {
  code: { type: "string", description: "MoroccoAPI province or prefecture code, as in /api/v2/provinces." },
  hcp_code: { type: "string", description: "HCP geographic code of the province or prefecture, in the dotted form used by the geography endpoints." },
  name: {
    type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
    properties: { ar: { type: "string" }, fr: { type: "string" }, en: nullableString },
    description: "Name from the administrative geography snapshot.",
  },
  region_code: { type: "string", description: "MoroccoAPI code of the region of the province or prefecture." },
  area: { enum: LABOUR_AREAS, description: "all (the whole province or prefecture, urban and rural together), urban or rural." },
  year: { type: "integer", description: "Survey year." },
  activity_rate: rate("Percentage of the population aged 15 and over that is in the labour force (employed or unemployed). Null when HCP does not publish it."),
  employment_rate: rate("Percentage of the population aged 15 and over that is employed. Null when HCP does not publish it."),
  unemployment_rate: rate("Percentage of the labour force that is unemployed. Null when HCP does not publish it."),
} as const;

export const labourObservationSchema = {
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

export function labourMetaSchema() {
  const meta = buildLabourDatasetMeta(0);
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

export const labourQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    province_code: { ...slug, description: "Only this province or prefecture." },
    region_code: { ...slug, maxLength: 80, description: "Only provinces and prefectures in this region." },
    area: { enum: LABOUR_AREAS, default: "all", description: "all, urban or rural. Defaults to all (the whole province or prefecture)." },
    year: { ...year, description: "Only this survey year." },
    from: { ...year, description: "First survey year to include." },
    to: { ...year, description: "Last survey year to include." },
  },
} as const;
