const nonEmptyString = { type: "string", minLength: 1 } as const;
const nullableString = { anyOf: [nonEmptyString, { type: "null" }] } as const;
const slug = { type: "string", maxLength: 100, pattern: "^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$" } as const;

export const consulateSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "country", "city", "address", "phones", "website", "source_names", "quality_flags"],
  properties: {
    id: slug,
    name: {
      type: "object", additionalProperties: false, required: ["fr"],
      properties: { fr: nonEmptyString },
    },
    country: {
      type: "object", additionalProperties: false, required: ["code", "name"],
      properties: { code: { type: "string", pattern: "^[A-Z]{2}$" }, name: nonEmptyString },
    },
    city: nonEmptyString,
    address: nullableString,
    phones: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["raw", "e164"],
        properties: {
          raw: nonEmptyString,
          e164: { anyOf: [{ type: "string", pattern: "^\\+[1-9][0-9]{6,14}$" }, { type: "null" }] },
        },
      },
    },
    website: { anyOf: [{ type: "string", format: "uri", pattern: "^https?://" }, { type: "null" }] },
    source_names: { type: "array", minItems: 1, items: nonEmptyString },
    quality_flags: { type: "array", items: nonEmptyString },
  },
} as const;

export const consulateMetaSchema = {
  type: "object", additionalProperties: false,
  required: ["dataset", "total", "license", "terms_url", "redistribution_status", "retrieved_at", "source_updated_at", "transformation_version", "coverage", "sources"],
  properties: {
    dataset: { const: "moroccan-consulates" },
    total: { type: "integer", minimum: 0 },
    license: { type: "null" },
    terms_url: { type: "string", format: "uri" },
    redistribution_status: { const: "permission-not-obtained" },
    retrieved_at: { type: "string", format: "date" },
    source_updated_at: { type: "null" },
    transformation_version: nonEmptyString,
    coverage: {
      type: "object", additionalProperties: false,
      required: ["records", "countries", "complete", "real_time", "limitations"],
      properties: {
        records: { type: "integer", minimum: 1 }, countries: { type: "integer", minimum: 1 },
        complete: { const: false }, real_time: { const: false },
        limitations: { type: "array", items: nonEmptyString },
      },
    },
    sources: {
      type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["dataset", "producer", "source_url"],
        properties: { dataset: nonEmptyString, producer: nonEmptyString, source_url: { type: "string", format: "uri" } },
      },
    },
  },
} as const;

export const consulateQuerySchema = {
  type: "object", additionalProperties: false,
  properties: { country: { type: "string", pattern: "^[A-Za-z]{2}$", description: "Two-letter country code, case-insensitive (e.g. FR)." } },
} as const;

export const consulateParamsSchema = {
  type: "object", additionalProperties: false, required: ["id"], properties: { id: slug },
} as const;
