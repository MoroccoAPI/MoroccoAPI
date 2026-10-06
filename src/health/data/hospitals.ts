import { readFile } from "node:fs/promises";

import type { GeographyData, Region } from "../../geography/types.js";
import { hospitalCategories } from "../categories.js";
import type { Hospital } from "../types.js";

const datasetUrl = new URL("../../../data/health/hospitals.json", import.meta.url);
const categories = new Set<string>(hospitalCategories);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "");
}

function assertHospital(value: unknown, index: number): asserts value is Hospital {
  if (!isRecord(value) || typeof value.id !== "string" || !/^hospital-[a-z0-9-]+$/.test(value.id) ||
    typeof value.name !== "string" || value.name.trim() === "" ||
    !isStrings(value.aliases) || typeof value.region_code !== "string" || typeof value.province_code !== "string" ||
    !(value.commune_code === null || typeof value.commune_code === "string") ||
    !(value.arrondissement_code === null || typeof value.arrondissement_code === "string") ||
    !(value.category === null || typeof value.category === "string" && categories.has(value.category)) ||
    !(value.category_label === null || typeof value.category_label === "string") ||
    !(value.ownership === null || value.ownership === "public") ||
    !(value.reference_year === null || Number.isInteger(value.reference_year))
  ) {
    throw new Error(`Invalid hospital record at index ${index}`);
  }
  if (value.location !== null) {
    const location = value.location;
    if (!isRecord(location) || typeof location.latitude !== "number" || typeof location.longitude !== "number" ||
      !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
      Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
      throw new Error(`Invalid location for hospital '${value.id}'`);
    }
  }
}

export async function loadHospitals(
  regions: readonly Region[],
  geography: GeographyData,
): Promise<readonly Hospital[]> {
  const parsed: unknown = JSON.parse(await readFile(datasetUrl, "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Hospitals dataset must contain records");
  }
  const hospitals: Hospital[] = parsed.map((record: unknown, index: number) => {
    assertHospital(record, index);
    return record;
  });
  const ids = new Set<string>();
  const regionCodes = new Set(regions.map((region) => region.code));
  const provinceByCode = new Map(geography.provinces.map((province) => [province.code, province]));
  const communeByCode = new Map(geography.communes.map((commune) => [commune.code, commune]));
  const arrondissementByCode = new Map(geography.arrondissements.map((arrondissement) => [arrondissement.code, arrondissement]));
  for (const record of hospitals) {
    if (ids.has(record.id)) throw new Error(`Duplicate hospital ID '${record.id}'`);
    ids.add(record.id);
    const province = provinceByCode.get(record.province_code);
    if (!regionCodes.has(record.region_code) || !province || province.region_code !== record.region_code) {
      throw new Error(`Invalid hospital province/region relationship for '${record.id}'`);
    }
    if (record.commune_code !== null && communeByCode.get(record.commune_code)?.province_code !== record.province_code) {
      throw new Error(`Invalid hospital commune for '${record.id}'`);
    }
    if (record.arrondissement_code !== null && arrondissementByCode.get(record.arrondissement_code)?.commune_code !== record.commune_code) {
      throw new Error(`Invalid hospital arrondissement for '${record.id}'`);
    }
  }
  return Object.freeze(
    hospitals.map((record) => Object.freeze({
      ...record,
      aliases: Object.freeze([...record.aliases]),
      location: record.location === null ? null : Object.freeze({ ...record.location }),
    })),
  );
}
