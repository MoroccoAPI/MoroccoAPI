import { buildDatasetMeta } from "./metadata.js";

const string = { type: "string", minLength: 1 } as const;
const stringArray = { type: "array", items: string } as const;
const nullableString = { anyOf: [string, { type: "null" }] } as const;

export const museumSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name", "aliases", "city_code", "region_code", "address_fr", "contact",
    "opening_hours_text_fr", "admission_text_fr", "coordinates", "operating_status", "quality_flags"],
  properties: {
    id: { ...string, pattern: "^fnm-[a-z0-9-]+$", description: "Stable internal MoroccoAPI ID, not an official FNM code." },
    name: {
      type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
      properties: { ar: string, fr: string, en: nullableString },
    },
    aliases: { ...stringArray, description: "French heading from the official guide, when different from the XLSX name." },
    city_code: { ...string, description: "Commune slug from the HCP geography snapshot." },
    region_code: string,
    address_fr: string,
    contact: {
      type: "object", additionalProperties: false, required: ["phone_e164", "phone_status", "social_handles"],
      properties: {
        phone_e164: { anyOf: [{ type: "string", pattern: "^\\+212[5-7]\\d{8}$" }, { type: "null" }] },
        phone_status: { type: "string", enum: ["format_valid_unverified", "invalid_format", "missing"],
          description: "Format validation only. Numbers may be shared and are not operationally verified." },
        social_handles: { ...stringArray, description: "Public visitor handles; platform is not inferred." },
      },
    },
    opening_hours_text_fr: { ...string, description: "Source visitor schedule; not a current opening guarantee." },
    admission_text_fr: { ...string, description: "Source tariff excerpt. Consult the guide for free-entry/reduction conditions." },
    coordinates: { type: "null", description: "No coordinates in the admitted source." },
    operating_status: { type: "string", enum: ["unknown"] },
    quality_flags: { ...stringArray, description: "Known source issues, including shared/missing phones and works mentions." },
  },
} as const;

export const museumParamsSchema = {
  type: "object", additionalProperties: false, required: ["id"],
  properties: { id: { type: "string", pattern: "^fnm-[a-z0-9-]+$", maxLength: 200 } },
} as const;

export function museumQuerySchema(cityCodes: readonly string[], regionCodes: readonly string[]) {
  return {
    type: "object", additionalProperties: false,
    properties: {
      q: { type: "string", minLength: 2, maxLength: 100, description: "Search French/Arabic names, guide aliases and city names; accents and Arabic diacritics are ignored." },
      city_code: { type: "string", enum: cityCodes },
      region_code: { type: "string", enum: regionCodes },
    },
  } as const;
}

const meta = buildDatasetMeta(0);
export const datasetMetaSchema = {
  type: "object", additionalProperties: false, required: Object.keys(meta),
  properties: {
    dataset: { const: meta.dataset }, total: { type: "integer", minimum: 0 },
    license: { const: meta.license }, retrieved_at: { const: meta.retrieved_at },
    transformation_version: { const: meta.transformation_version },
    source_version: { const: meta.source_version }, scope: string, limitations: stringArray,
    sources: { type: "array", minItems: 3, items: {
      type: "object", additionalProperties: false,
      required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
      properties: {
        dataset: string, producer: string,
        source_url: { type: "string", format: "uri" }, resource_url: { type: "string", format: "uri" },
        license: { type: "string", enum: ["ODbL-1.0", "CC-BY-4.0"] },
        source_updated_at: { type: "string", format: "date" },
      },
    } },
  },
} as const;
