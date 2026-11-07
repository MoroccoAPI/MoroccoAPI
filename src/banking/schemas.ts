const text = { type: "string", minLength: 1 } as const;
const date = { type: "string", format: "date" } as const;
const count = { type: "integer", minimum: 1 } as const;
export const bankCode = { type: "string", pattern: "^[0-9]{3}$", description: "Three-digit BAM bank code, preserving leading zeros. Not a SWIFT/BIC code." } as const;
export const institutionId = { type: "string", maxLength: 200, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" } as const;
const object = <T extends Record<string, unknown>>(properties: T) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties }) as const;
const sourceReference = object({ sheet: text, row: count });
const common = { name: text, category_code: text, category_name: text, source_ref: sourceReference };
export const institutionSchema = object({ id: institutionId, ...common, head_office_address: text });
export const bankCodeSchema = object({ code: bankCode, ...common });
export const categorySchema = object({ dataset: { type: "string", enum: ["institutions", "bank-codes"] }, code: text, name: text, count });
const sourceSchema = object({
  dataset: { type: "string", enum: ["institutions", "bank-codes"] }, filename: text, sheet: text, records: count,
  reference_date: { anyOf: [date, { type: "null" }] }, date_basis: text, sha256: { type: "string", pattern: "^[a-f0-9]{64}$" },
});
export const bankingMetaSchema = object({
  dataset: { const: "bam-banking" }, producer: { const: "Bank Al-Maghrib" }, total: { type: "integer", minimum: 0 },
  received_at: date, copied_at: date, transformation_version: text, license: { const: "LicenseRef-BAM-Charte-Diffusion" },
  terms_url: { type: "string", format: "uri" }, terms_section: text, attribution: text, notice: text,
  reuse: object({
    non_commercial_use: { const: "permitted-with-attribution-and-copy-date" }, commercial_use: { const: "written-permission-required" },
    modifications: { const: "disclose-changes-and-BAM-non-liability" },
  }),
  limitations: { type: "array", items: text }, sources: { type: "array", minItems: 2, maxItems: 2, items: sourceSchema },
});
export function searchSchema(categories: readonly string[]) {
  return { type: "object", additionalProperties: false, properties: {
    q: { type: "string", minLength: 2, maxLength: 160, description: "Search the source name (and head-office address for institutions), ignoring case and accents." },
    category: { type: "string", enum: categories, description: "Category code from /api/v2/banking/categories for the same dataset." },
  } };
}
