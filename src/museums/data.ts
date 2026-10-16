import { readFile } from "node:fs/promises";
import type { GeographySnapshot, SourceLanguageName } from "../geography/types.js";
import type { Museum } from "./types.js";

const datasetUrl = new URL("../../data/museums/museums.json", import.meta.url);
const phoneStatuses = new Set(["format_valid_unverified", "invalid_format", "missing"]);
const flags = new Set([
  "phone_missing", "phone_invalid_format", "phone_shared_in_source",
  "works_mentioned_in_xlsx", "hours_conflict_with_guide", "french_name_differs_from_guide",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}
function names(value: unknown): value is SourceLanguageName {
  return isRecord(value) && text(value.ar) && text(value.fr) && (value.en === null || text(value.en));
}

/** Validate and freeze the reviewed September 2026 visitor snapshot. */
export function validateMuseums(parsed: unknown, geography: GeographySnapshot): readonly Museum[] {
  if (!Array.isArray(parsed) || parsed.length !== 23) {
    throw new Error("The FNM September 2026 snapshot must contain 23 museums");
  }
  const ids = new Set<string>();
  const communes = new Map(geography.communes.map((row) => [row.code, row]));
  const regions = new Map(geography.regions.map((row) => [row.code, row]));
  const museums = parsed.map((row: unknown, index: number): Museum => {
    if (!isRecord(row) || !text(row.id) || !/^fnm-[a-z0-9-]+$/.test(row.id) ||
      !names(row.name) || row.name.en !== null || !strings(row.aliases) ||
      !text(row.city_code) || !text(row.region_code) ||
      !text(row.address_fr) || !text(row.opening_hours_text_fr) || !text(row.admission_text_fr) ||
      row.coordinates !== null || row.operating_status !== "unknown" ||
      !strings(row.quality_flags) || !row.quality_flags.every((flag) => flags.has(flag)) ||
      !isRecord(row.contact) ||
      !text(row.contact.phone_status) || !phoneStatuses.has(row.contact.phone_status) ||
      !strings(row.contact.social_handles) ||
      !row.contact.social_handles.every((handle) => /^[A-Za-z0-9._]+$/.test(handle)) ||
      (row.contact.phone_status === "format_valid_unverified"
        ? typeof row.contact.phone_e164 !== "string" || !/^\+212[5-7]\d{8}$/.test(row.contact.phone_e164)
        : row.contact.phone_e164 !== null)
    ) {
      throw new Error(`Invalid museum record at index ${index}`);
    }
    if (ids.has(row.id)) throw new Error(`Duplicate museum ID '${row.id}'`);
    ids.add(row.id);
    const commune = communes.get(row.city_code);
    const region = regions.get(row.region_code);
    if (!commune || !region || commune.region_code !== region.code) {
      throw new Error(`Invalid museum geography for '${row.id}'`);
    }
    return Object.freeze({
      id: row.id,
      name: Object.freeze({ ...row.name }),
      aliases: Object.freeze([...row.aliases]),
      city_code: row.city_code,
      region_code: row.region_code,
      address_fr: row.address_fr,
      contact: Object.freeze({
        phone_e164: row.contact.phone_e164 as string | null,
        phone_status: row.contact.phone_status as Museum["contact"]["phone_status"],
        social_handles: Object.freeze([...row.contact.social_handles]),
      }),
      opening_hours_text_fr: row.opening_hours_text_fr,
      admission_text_fr: row.admission_text_fr,
      coordinates: null,
      operating_status: "unknown",
      quality_flags: Object.freeze([...row.quality_flags]),
    });
  });
  return Object.freeze(museums);
}

export async function loadMuseums(geography: GeographySnapshot): Promise<readonly Museum[]> {
  const parsed: unknown = JSON.parse(await readFile(datasetUrl, "utf8"));
  return validateMuseums(parsed, geography);
}
