import { damBasins } from "./types.js";

const dateSchema = { type: "string", format: "date" } as const;
const slugSchema = { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } as const;
const dateBasisSchema = { type: "string", enum: ["source_calendar", "dashboard_headline"] } as const;
const nullableNumberSchema = { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] } as const;
const nullableUriSchema = { anyOf: [{ type: "string", format: "uri" }, { type: "null" }] } as const;

export const damLevelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dam_id", "date", "date_basis", "capacity_mm3", "volume_mm3", "filling_rate_pct", "source_id", "source_ref"],
  properties: {
    dam_id: slugSchema,
    date: dateSchema,
    date_basis: dateBasisSchema,
    capacity_mm3: nullableNumberSchema,
    volume_mm3: { type: "number", minimum: 0 },
    filling_rate_pct: { type: "number", minimum: 0 },
    previous_year_filling_rate_pct: nullableNumberSchema,
    source_id: { type: "string" },
    source_ref: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["sheet", "row"],
          properties: { sheet: { type: "string" }, row: { type: "integer", minimum: 1 } },
        },
        {
          type: "object",
          additionalProperties: false,
          required: ["basin_code", "dam_index"],
          properties: { basin_code: { type: "string", pattern: "^MH[1-9]$" }, dam_index: { type: "integer", minimum: 1 } },
        },
      ],
    },
  },
} as const;

export const damSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "basin", "latest_level"],
  properties: {
    id: slugSchema,
    name: {
      type: "object",
      additionalProperties: false,
      required: ["fr"],
      properties: {
        fr: { anyOf: [{ type: "string" }, { type: "null" }] },
        ar: { type: "string" },
      },
    },
    basin: { type: "string", enum: damBasins },
    latest_level: damLevelSchema,
  },
} as const;

export const damMetaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataset", "total", "license", "license_url", "retrieved_at", "source_updated_at", "transformation_version", "coverage", "sources"],
  properties: {
    dataset: { const: "morocco-dams" },
    total: { type: "integer", minimum: 0 },
    license: { const: "mixed" },
    license_url: { type: "null" },
    retrieved_at: dateSchema,
    source_updated_at: { anyOf: [dateSchema, { type: "null" }] },
    transformation_version: { type: "string" },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: ["basin", "basins", "from", "to", "real_time", "complete_national_coverage", "limitations"],
      properties: {
        basin: { anyOf: [{ type: "string", enum: damBasins }, { type: "null" }] },
        basins: { type: "array", items: { type: "string", enum: damBasins } },
        from: dateSchema,
        to: dateSchema,
        real_time: { const: false },
        complete_national_coverage: { const: false },
        limitations: { type: "array", items: { type: "string" } },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "dataset", "producer", "source_url", "resource_url", "license", "license_url", "date_basis", "source_updated_at"],
        properties: {
          id: { type: "string" },
          dataset: { type: "string" },
          producer: { type: "string" },
          source_url: { type: "string", format: "uri" },
          resource_url: { type: "string", format: "uri" },
          license: { anyOf: [{ const: "ODbL-1.0" }, { type: "null" }] },
          license_url: nullableUriSchema,
          date_basis: dateBasisSchema,
          source_updated_at: { anyOf: [dateSchema, { type: "null" }] },
        },
      },
    },
  },
} as const;

export const damQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { basin: slugSchema },
} as const;

export const damParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: slugSchema },
} as const;

export const levelQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: { from: dateSchema, to: dateSchema },
} as const;
