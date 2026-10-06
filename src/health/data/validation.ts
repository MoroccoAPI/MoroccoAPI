import type { GeographyData, Region } from "../../geography/types.js";

interface FacilityGeography {
  id: string;
  region_code: string;
  province_code: string;
  commune_code: string | null;
  arrondissement_code: string | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "");
}

export function validateFacilityGeography(
  records: readonly FacilityGeography[],
  regions: readonly Region[],
  geography: GeographyData,
  label: string,
): void {
  const ids = new Set<string>();
  const regionCodes = new Set(regions.map((region) => region.code));
  const provinceByCode = new Map(geography.provinces.map((province) => [province.code, province]));
  const communeByCode = new Map(geography.communes.map((commune) => [commune.code, commune]));
  const arrondissementByCode = new Map(geography.arrondissements.map((arrondissement) => [arrondissement.code, arrondissement]));
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate ${label} ID '${record.id}'`);
    ids.add(record.id);
    const province = provinceByCode.get(record.province_code);
    if (!regionCodes.has(record.region_code) || !province || province.region_code !== record.region_code) {
      throw new Error(`Invalid ${label} province/region relationship for '${record.id}'`);
    }
    if (record.commune_code !== null && communeByCode.get(record.commune_code)?.province_code !== record.province_code) {
      throw new Error(`Invalid ${label} commune for '${record.id}'`);
    }
    if (record.arrondissement_code !== null && arrondissementByCode.get(record.arrondissement_code)?.commune_code !== record.commune_code) {
      throw new Error(`Invalid ${label} arrondissement for '${record.id}'`);
    }
  }
}
