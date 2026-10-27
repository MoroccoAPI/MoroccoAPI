import { territorySchema } from "../indicators/schemas.js";
import { INDICATOR_LEVELS } from "../indicators/types.js";
import { buildPovertyDatasetMeta } from "./metadata.js";
import { DEPRIVATIONS, MPI_TRENDS, POVERTY_AREAS, POVERTY_YEARS } from "./types.js";

const percent = { anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] } as const;
const slug = { type: "string", minLength: 2, maxLength: 180, pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" } as const;

const { data_from_local_administration: _census, ...territoryProperties } = territorySchema.properties;
const povertyTerritorySchema = {
  type: "object", additionalProperties: false, required: Object.keys(territoryProperties), properties: territoryProperties,
} as const;

const observationProperties = {
  area: { enum: POVERTY_AREAS, description: "all (urban and rural together), urban or rural." },
  year: { enum: POVERTY_YEARS, description: "Census year: 2024, or 2014 as revised by HCP for comparison." },
  mpi: {
    anyOf: [{ type: "number", minimum: 0, maximum: 1 }, { type: "null" }],
    description: "Multidimensional poverty index (MPI = H × A), between 0 and 1. HCP leaves it empty (null) when no one is poor.",
  },
  poverty_rate: { ...percent, description: "H: percentage of the population in multidimensional poverty." },
  poverty_intensity: { ...percent, description: "A: average share of deprivations among poor people, in percent. Null when no one is poor." },
  vulnerability_rate: { ...percent, description: "Percentage of the population vulnerable to multidimensional poverty." },
  deprivation_rates: {
    type: "object", additionalProperties: false, required: [...DEPRIVATIONS],
    description: "Percentage of the population deprived in each of the ten indicators.",
    properties: Object.fromEntries(DEPRIVATIONS.map((deprivation) => [deprivation, percent])),
  },
  mpi_trend: {
    anyOf: [{ enum: MPI_TRENDS }, { type: "null" }],
    description: "HCP's reading of the MPI change between 2014 and 2024, on 2024 observations only; null on 2014 observations.",
  },
  aligned_with_dakhla: {
    type: "boolean",
    description: "True for the 2014 values of four communes that HCP aligned on the commune of Dakhla because of seasonal mobility during the 2014 census.",
  },
} as const;

export const observationSchema = {
  type: "object", additionalProperties: false, required: Object.keys(observationProperties), properties: observationProperties,
} as const;

export const territoryObservationSchema = {
  type: "object", additionalProperties: false,
  required: [...Object.keys(territoryProperties), ...Object.keys(observationProperties)],
  properties: { ...territoryProperties, ...observationProperties },
} as const;

export const povertyProfileSchema = {
  type: "object", additionalProperties: false, required: ["territory", "observations"],
  properties: {
    territory: povertyTerritorySchema,
    observations: {
      type: "array", items: observationSchema,
      description: "One entry per area and year with source values, all areas first and 2024 before 2014.",
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

export function povertyMetaSchema() {
  const meta = buildPovertyDatasetMeta(0);
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

const area = { enum: POVERTY_AREAS } as const;
const year = { type: "integer", enum: POVERTY_YEARS } as const;

export const povertyQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    level: { enum: INDICATOR_LEVELS, default: "regions", description: "Territorial level to list. Defaults to regions." },
    area: { ...area, default: "all", description: "all, urban or rural. Defaults to all; territories without values for the area are omitted." },
    year: { ...year, default: 2024, description: "2024 or 2014. Defaults to 2024." },
    region_code: { ...slug, maxLength: 80, description: "Only territories in this region (for level regions, the region itself)." },
    province_code: { ...slug, description: "Only territories in this province or prefecture (for level subdivisions, the unit itself)." },
  },
} as const;

export const povertyProfileQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    area: { ...area, description: "Only this area: all, urban or rural." },
    year: { ...year, description: "Only this year: 2024 or 2014." },
  },
} as const;
