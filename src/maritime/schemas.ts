import { buildMaritimeMeta } from "./metadata.js";

const text = { type: "string", minLength: 1 } as const;
const meta = buildMaritimeMeta("ports", 0);

export const portSchema = {
  type: "object", additionalProperties: false,
  required: ["Nom du port", "Type de ports", "Connectivité", "Latitude", "Longitude", "Etat"],
  properties: {
    "Nom du port": text,
    "Type de ports": text,
    "Connectivité": text,
    Latitude: { type: "number", minimum: -90, maximum: 90 },
    Longitude: { type: "number", minimum: -180, maximum: 180 },
    Etat: text,
  },
} as const;

export const lighthouseSchema = {
  type: "object", additionalProperties: false,
  required: ["Nom", "Region", "Province", "Ville", "Date de mise en service", "Type du phare", "Caracteristique_rythme", "Portee_mile"],
  properties: {
    Nom: text,
    Region: text,
    Province: text,
    Ville: text,
    "Date de mise en service": { anyOf: [{ type: "integer" }, text] },
    "Type du phare": text,
    Caracteristique_rythme: text,
    Portee_mile: { anyOf: [{ type: "number", minimum: 0 }, text] },
  },
} as const;

const filterText = { type: "string", minLength: 2, maxLength: 100 } as const;
const filterMinimum = "Requires at least two characters after search normalization, including trimming whitespace and removing accents.";

export const lighthouseQuerySchema = {
  type: "object", additionalProperties: false,
  properties: {
    name: { ...filterText, description: `Filter by lighthouse name. ${filterMinimum}` },
    region: { ...filterText, description: `Filter by lighthouse region. ${filterMinimum}` },
    province: { ...filterText, description: `Filter by lighthouse province. ${filterMinimum}` },
    type: { ...filterText, description: `Filter by lighthouse type. ${filterMinimum}` },
    ville: { ...filterText, description: `Filter by lighthouse city. ${filterMinimum}` },
  },
} as const;

export const portParamsSchema = {
  type: "object", additionalProperties: false, required: ["name"],
  properties: { name: { type: "string", minLength: 2, maxLength: 200 } },
} as const;

export const maritimeMetaSchema = {
  type: "object", additionalProperties: false,
  required: Object.keys(meta),
  properties: {
    dataset: { type: "string", enum: ["morocco-ports", "morocco-lighthouses"] },
    total: { type: "integer", minimum: 0 },
    license: { const: "ODbL-1.0" },
    license_url: { type: "string", format: "uri" },
    retrieved_at: { type: "string", format: "date" },
    source_updated_at: { type: "string", format: "date" },
    transformation_version: { type: "string" },
    scope: text,
    limitations: { type: "array", items: text },
    sources: { type: "array", minItems: 1, maxItems: 1, items: {
      type: "object", additionalProperties: false,
      required: ["dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
      properties: {
        dataset: text, producer: text,
        source_url: { type: "string", format: "uri" }, resource_url: { type: "string", format: "uri" },
        license: { const: "ODbL-1.0" }, source_updated_at: { type: "string", format: "date" },
      },
    } },
  },
} as const;
