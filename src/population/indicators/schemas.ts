import { buildIndicatorDatasetMeta } from "./metadata.js";
import { INDICATOR_LEVELS, INDICATOR_UNITS, SEXES } from "./types.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nullableNumber = { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] } as const;
const slug = { type: "string", minLength: 2, maxLength: 180, pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" } as const;
const indicatorId = { type: "string", minLength: 2, maxLength: 64, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } as const;

const localizedName = {
  type: "object", additionalProperties: false, required: ["fr", "en", "ar"],
  properties: { fr: { type: "string" }, en: { type: "string" }, ar: { type: "string" } },
} as const;

const territoryProperties = {
  level: { enum: INDICATOR_LEVELS },
  code: { ...nullableString, description: "MoroccoAPI geography code; null for the national total." },
  hcp_code: { ...nullableString, description: "HCP geographic code in the dotted form used by the geography endpoints; null for the national total." },
  name: {
    type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
    properties: { ar: { type: "string" }, fr: { type: "string" }, en: nullableString },
  },
  region_code: nullableString,
  province_code: nullableString,
  data_from_local_administration: {
    type: "boolean",
    description: "True for the four communes that HCP marks with *: their data comes from the local administration because of seasonal mobility.",
  },
} as const;

const reason = { anyOf: [{ enum: ["unavailable", "not_applicable", "not_published"] }, { type: "null" }] } as const;
const valueProperties = {
  both_sexes: nullableNumber,
  male: nullableNumber,
  female: nullableNumber,
  null_reasons: {
    type: "object", additionalProperties: false, required: [...SEXES],
    description: "Why each value is null: unavailable (HCP \".\"), not_applicable (HCP \"…\") or not_published (HCP gives no value for that sex). Null when the value is present.",
    properties: { both_sexes: reason, male: reason, female: reason },
  },
} as const;

export const territorySchema = {
  type: "object", additionalProperties: false, required: Object.keys(territoryProperties), properties: territoryProperties,
} as const;

export const indicatorDefinitionSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "group", "group_name", "unit", "name", "source_label", "sexes"],
  properties: {
    id: indicatorId,
    group: { type: "string" },
    group_name: localizedName,
    unit: { enum: INDICATOR_UNITS },
    name: { ...localizedName, description: "fr follows the HCP label; en and ar are MoroccoAPI translations." },
    source_label: { type: "string", description: "Column header in the HCP file (French)." },
    sexes: { type: "array", minItems: 1, items: { enum: SEXES }, description: "Breakdowns published by HCP for this indicator." },
  },
} as const;

export const territoryValueSchema = {
  type: "object", additionalProperties: false,
  required: [...Object.keys(territoryProperties), ...Object.keys(valueProperties)],
  properties: { ...territoryProperties, ...valueProperties },
} as const;

export const profileSchema = {
  type: "object", additionalProperties: false, required: ["territory", "indicators"],
  properties: {
    territory: territorySchema,
    indicators: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "group", "unit", "name", ...Object.keys(valueProperties)],
        properties: { id: indicatorId, group: { type: "string" }, unit: { enum: INDICATOR_UNITS }, name: localizedName, ...valueProperties },
      },
    },
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

export function indicatorMetaSchema() {
  const meta = buildIndicatorDatasetMeta(0);
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

export function catalogueQuerySchema(groupIds: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      q: {
        type: "string", minLength: 2, maxLength: 100,
        description: "Part of an indicator id or name in French, English or Arabic (accent- and case-insensitive).",
      },
      group: { type: "string", enum: groupIds },
    },
  } as const;
}

export const indicatorParamsSchema = {
  type: "object", additionalProperties: false, required: ["id"], properties: { id: indicatorId },
} as const;

export const territoryQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    level: { enum: INDICATOR_LEVELS, default: "regions", description: "Territorial level to list. Defaults to regions." },
    region_code: { ...slug, maxLength: 80, description: "Only territories in this region (for level regions, the region itself)." },
    province_code: { ...slug, description: "Only territories in this province or prefecture (for level subdivisions, the unit itself)." },
  },
} as const;

export function profileParamsSchema() {
  return {
    type: "object", additionalProperties: false, required: ["level", "code"],
    properties: { level: { enum: INDICATOR_LEVELS.filter((level) => level !== "national") }, code: slug },
  } as const;
}

export function profileQuerySchema(groupIds: readonly string[]) {
  return {
    type: "object", additionalProperties: false,
    properties: { group: { type: "string", enum: groupIds } },
  } as const;
}
