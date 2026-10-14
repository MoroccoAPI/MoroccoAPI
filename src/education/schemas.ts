import type { EducationDatasetMeta } from "./types.js";
import { schoolCategories } from "./types.js";
import { buildEducationMeta } from "./metadata.js";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

export const schoolSchema = {
  type: "object", additionalProperties: false,
  required: ["id", "name_fr", "name_ar", "address_fr", "address_ar", "commune", "province", "region", "category", "ownership"],
  properties: {
    id: { type: "string" }, name_fr: { type: "string" }, name_ar: { type: "string" },
    address_fr: nullableString, address_ar: nullableString,
    commune: { type: "string", description: "Commune or arrondissement label as published in the source." },
    province: { type: "string", description: "Province or prefecture label as published in the source." },
    region: { type: "string" },
    category: { type: "string", enum: schoolCategories },
    ownership: { type: "string", enum: ["public", "private"] },
  },
} as const;

export const universitySchema = {
  type: "object", additionalProperties: false,
  required: ["id", "university_fr", "university_ar", "establishment_fr", "establishment_ar", "abbreviation", "city", "address", "enrollment_2023_2024", "telephone", "fax"],
  properties: {
    id: { type: "string" }, university_fr: { type: "string" }, university_ar: { type: "string" },
    establishment_fr: { type: "string" }, establishment_ar: { type: "string" }, abbreviation: { type: "string" },
    city: { type: "string" }, address: nullableString,
    enrollment_2023_2024: { anyOf: [{ type: "integer", minimum: 0 }, { type: "null" }] },
    telephone: nullableString, fax: nullableString,
  },
} as const;

export function educationMetaSchema(dataset: EducationDatasetMeta["dataset"]) {
  const meta = buildEducationMeta(dataset, 0);
  return {
    type: "object", additionalProperties: false,
    required: ["dataset", "total", "license", "retrieved_at", "transformation_version", "sources"],
    properties: {
      dataset: { const: dataset }, total: { type: "integer", minimum: 0 },
      license: { const: meta.license }, retrieved_at: { const: meta.retrieved_at },
      transformation_version: { const: meta.transformation_version },
      sources: {
        type: "array", minItems: 1,
        items: {
          type: "object", additionalProperties: false,
          required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
          properties: {
            dataset: { type: "string" }, producer: { type: "string" },
            source_url: { type: "string", format: "uri" }, resource_url: { type: "string", format: "uri" },
            license: { const: "ODbL-1.0" }, source_updated_at: { type: "string", format: "date" },
          },
        },
      },
    },
  } as const;
}

export function schoolQuerySchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      region: { type: "string", minLength: 2, maxLength: 100 },
      province: { type: "string", minLength: 2, maxLength: 100 },
      commune: { type: "string", minLength: 2, maxLength: 100 },
      search: { type: "string", minLength: 2, maxLength: 100, description: "Search names and addresses." },
    },
  } as const;
}

export function universityQuerySchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      city: { type: "string", minLength: 2, maxLength: 100 },
      university: { type: "string", minLength: 2, maxLength: 150 },
      search: {
        type: "string", minLength: 2, maxLength: 100,
        description: "Search university and establishment names, abbreviation, city, address, telephone, and fax.",
      },
    },
  } as const;
}

export const idParamsSchema = {
  type: "object", additionalProperties: false,
  required: ["id"], properties: { id: { type: "string", minLength: 1, maxLength: 100 } },
} as const;
