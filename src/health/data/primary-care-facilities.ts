import { readFile } from "node:fs/promises";

import type { GeographyData, Region } from "../../geography/types.js";
import { primaryCareCategories } from "../categories.js";
import type { PrimaryCareFacility } from "../types.js";
import { isRecord, isStrings, validateFacilityGeography } from "./validation.js";

const datasetUrl = new URL("../../../data/health/primary-care-facilities.json", import.meta.url);
const categories = new Set<string>(primaryCareCategories);

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function assertFacility(value: unknown, index: number): asserts value is PrimaryCareFacility {
  if (!isRecord(value) || typeof value.id !== "string" || !/^primary-care-[a-z0-9-]+$/.test(value.id) ||
    typeof value.name !== "string" || value.name.trim() === "" || !isStrings(value.aliases) ||
    typeof value.category !== "string" || !categories.has(value.category) ||
    typeof value.category_label !== "string" || value.category_label.trim() === "" || value.ownership !== "public" ||
    typeof value.region_code !== "string" || typeof value.province_code !== "string" ||
    !(value.commune_code === null || typeof value.commune_code === "string") ||
    !(value.arrondissement_code === null || typeof value.arrondissement_code === "string") ||
    !Number.isInteger(value.reference_year) ||
    !(value.last_service_event_date === null || isDate(value.last_service_event_date))
  ) {
    throw new Error(`Invalid primary-care facility record at index ${index}`);
  }
}

export async function loadPrimaryCareFacilities(
  regions: readonly Region[],
  geography: GeographyData,
): Promise<readonly PrimaryCareFacility[]> {
  const parsed: unknown = JSON.parse(await readFile(datasetUrl, "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Primary-care facilities dataset must contain records");
  }
  const facilities: PrimaryCareFacility[] = parsed.map((record: unknown, index: number) => {
    assertFacility(record, index);
    return record;
  });
  validateFacilityGeography(facilities, regions, geography, "primary-care facility");
  return Object.freeze(facilities.map((record) => Object.freeze({
    ...record, aliases: Object.freeze([...record.aliases]),
  })));
}
