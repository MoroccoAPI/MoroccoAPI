const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", format: "date" } as const;
const integer = { type: "integer", minimum: 0 } as const;
const nullableBoolean = { anyOf: [{ type: "boolean" }, { type: "null" }] } as const;
const urls = { type: "array", items: { type: "string" }, minItems: 1 } as const;

export const yearParamsSchema = {
  type: "object", required: ["year"], additionalProperties: false,
  properties: { year: { type: "string", pattern: "^\\d{4}$" } },
} as const;
export const checkQuerySchema = {
  type: "object", required: ["date"], additionalProperties: false,
  properties: { date },
} as const;
export const businessQuerySchema = {
  type: "object", required: ["from", "to"], additionalProperties: false,
  properties: { from: date, to: date },
} as const;

export const holidaySchema = {
  type: "object", additionalProperties: false,
  required: ["id", "date", "names", "type", "status", "day", "source_urls"],
  properties: {
    id: { type: "string" }, date: { anyOf: [date, { type: "null" }] },
    names: {
      type: "object", additionalProperties: false, required: ["ar", "fr", "en"],
      properties: { ar: { type: "string" }, fr: { type: "string" }, en: { type: "string" } },
    },
    type: { type: "string", enum: ["national", "religious"] },
    status: { type: "string", enum: ["fixed", "confirmed", "pending_confirmation"] },
    day: { type: "integer", minimum: 1, maximum: 2 }, source_urls: urls,
  },
} as const;
export const holidaysSchema = { type: "array", items: holidaySchema } as const;
export const checkSchema = {
  type: "object", additionalProperties: false,
  required: ["date", "is_weekend", "is_holiday", "is_business_day", "holidays"],
  properties: {
    date, is_weekend: { type: "boolean" }, is_holiday: nullableBoolean,
    is_business_day: nullableBoolean, holidays: holidaysSchema,
  },
} as const;
export const businessSchema = {
  type: "object", additionalProperties: false,
  required: ["from", "to", "inclusive", "calendar_days", "weekend_days", "holiday_weekdays", "business_days", "business_days_upper_bound", "is_exact"],
  properties: {
    from: date, to: date, inclusive: { const: true }, calendar_days: integer,
    weekend_days: integer, holiday_weekdays: integer,
    business_days: { anyOf: [integer, { type: "null" }] },
    business_days_upper_bound: integer, is_exact: { type: "boolean" },
  },
} as const;
export const metaSchema = {
  type: "object", additionalProperties: false,
  required: ["dataset", "total", "license", "license_url", "reviewed_at", "transformation_version", "scope", "weekend_days", "years", "calendar_complete", "pending_holiday_days", "sources", "limitations"],
  properties: {
    dataset: { const: "moroccan-public-holidays" }, total: integer,
    license: { type: "string" }, license_url: { type: "string" }, reviewed_at: date,
    transformation_version: { type: "string" }, scope: { const: "public-administration-common-calendar" },
    weekend_days: { type: "array", items: { type: "string", enum: ["Saturday", "Sunday"] } },
    years: { type: "array", items: { type: "integer" } },
    calendar_complete: { type: "boolean" }, pending_holiday_days: integer,
    sources: {
      type: "array", items: {
        type: "object", additionalProperties: false, required: ["producer", "source_url", "source_updated_at"],
        properties: {
          producer: { type: "string" }, source_url: { type: "string" },
          source_updated_at: { anyOf: [date, { type: "null" }] },
        },
      },
    },
    limitations: { type: "array", items: { type: "string" } },
  },
} as const;
