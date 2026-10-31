import { intermediaryCategories } from "./types.js";

const text = { type: "string", minLength: 1 } as const;
const nullableText = { anyOf: [text, { type: "null" }] } as const;
const code = { type: "string", maxLength: 64, pattern: "^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$" } as const;

export const intermediarySchema = {
  type: "object", additionalProperties: false,
  required: ["acaps_code", "name", "category", "insurer", "city"],
  properties: {
    acaps_code: { ...code, description: "ACAPS code as published; retained as text, including leading zeros and branch suffixes." },
    name: { ...nullableText, description: "Source business name or professional representative; may identify an individual. Null when blank in the source." },
    category: { type: "string", enum: intermediaryCategories },
    insurer: { ...nullableText, description: "Source mandante, or null when absent. Does not establish exclusivity." },
    city: { ...nullableText, description: "Unmodified source locality label; may include a district or parent city." },
  },
} as const;

export const insuranceMetaSchema = {
  type: "object", additionalProperties: false,
  required: ["dataset", "total", "license", "terms_url", "redistribution_status", "retrieved_at", "source_updated_at", "transformation_version", "source_record_count", "coverage", "real_time", "limitations", "sources"],
  properties: {
    dataset: { const: "acaps-insurance-intermediaries" },
    total: { type: "integer", minimum: 0 },
    license: { type: "null" },
    terms_url: { type: "string", format: "uri" },
    redistribution_status: { const: "permission-not-obtained" },
    retrieved_at: { type: "string", format: "date" },
    source_updated_at: { type: "null" },
    transformation_version: text,
    source_record_count: { type: "integer", minimum: 1 },
    coverage: {
      type: "object", additionalProperties: false, required: ["records", "complete"],
      properties: { records: { type: "integer", minimum: 1 }, complete: { type: "boolean" } },
    },
    real_time: { const: false },
    limitations: { type: "array", items: text },
    sources: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["dataset", "producer", "source_url"],
        properties: { dataset: text, producer: text, source_url: { type: "string", format: "uri" } },
      },
    },
  },
} as const;

export const intermediaryQuerySchema = {
  type: "object", additionalProperties: false,
  properties: {
    q: { type: "string", minLength: 2, maxLength: 200, description: "Substring search in name, ACAPS code and insurer; ignores case and accents." },
    city: { type: "string", minLength: 2, maxLength: 200, description: "Substring of the source locality label, ignoring case and accents (e.g. Fes matches Fès-El Mariniyine). Not an administrative boundary filter." },
    category: { type: "string", enum: intermediaryCategories, description: "agent = AGENT; broker = COURTIER; direct-office = BUREAU DE GESTION DIRECTE." },
  },
} as const;

export const intermediaryParamsSchema = {
  type: "object", additionalProperties: false, required: ["code"], properties: { code },
} as const;
