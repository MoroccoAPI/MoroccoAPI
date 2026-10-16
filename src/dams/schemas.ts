const dateSchema = { type: "string", format: "date" } as const;
const slugSchema = { type: "string", minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } as const;

export const damLevelSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dam_id", "date", "capacity_mm3", "volume_mm3", "filling_rate_pct", "source_id", "source_ref"],
  properties: {
    dam_id: slugSchema,
    date: dateSchema,
    capacity_mm3: { type: "number", minimum: 0 },
    volume_mm3: { type: "number", minimum: 0 },
    filling_rate_pct: { type: "number", minimum: 0 },
    source_id: { type: "string" },
    source_ref: {
      type: "object",
      additionalProperties: false,
      required: ["sheet", "row"],
      properties: { sheet: { type: "string" }, row: { type: "integer", minimum: 1 } },
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
      properties: { fr: { type: "string" } },
    },
    basin: { const: "tensift" },
    latest_level: damLevelSchema,
  },
} as const;

export const damMetaSchema = {
  type: "object",
  additionalProperties: false,
  required: ["dataset", "total", "license", "license_url", "retrieved_at", "source_updated_at", "transformation_version", "coverage", "sources"],
  properties: {
    dataset: { const: "tensift-dams" },
    total: { type: "integer", minimum: 0 },
    license: { const: "ODbL-1.0" },
    license_url: { type: "string", format: "uri" },
    retrieved_at: dateSchema,
    source_updated_at: { anyOf: [dateSchema, { type: "null" }] },
    transformation_version: { type: "string" },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: ["basin", "from", "to", "real_time", "limitations"],
      properties: {
        basin: { const: "tensift" },
        from: dateSchema,
        to: dateSchema,
        real_time: { const: false },
        limitations: { type: "array", items: { type: "string" } },
      },
    },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "dataset", "producer", "source_url", "resource_url", "license", "source_updated_at"],
        properties: {
          id: { type: "string" },
          dataset: { type: "string" },
          producer: { type: "string" },
          source_url: { type: "string", format: "uri" },
          resource_url: { type: "string", format: "uri" },
          license: { const: "ODbL-1.0" },
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
