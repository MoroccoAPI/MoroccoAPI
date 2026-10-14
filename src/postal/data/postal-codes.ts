import { readFile } from "node:fs/promises";

import type { GeographySnapshot } from "../../geography/types.js";
import type { MultiCodeCity, MultiCodeCitySource, PostalCode, PostalData } from "../types.js";

const codesUrl = new URL("../../../data/postal/postal-codes.json", import.meta.url);
const citiesUrl = new URL("../../../data/postal/multi-code-cities.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value === value.trim() && !/\s{2}/.test(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function assertCity(value: unknown, index: number): asserts value is MultiCodeCitySource {
  if (!isRecord(value) || !isName(value.name) || typeof value.province_code !== "string" ||
    typeof value.region_code !== "string" || !isNullableString(value.commune_code)) {
    throw new Error(`Invalid multi-code city at index ${index}`);
  }
}

function assertPostalCode(value: unknown, index: number): asserts value is PostalCode {
  if (!isRecord(value) || typeof value.postal_code !== "string" || !/^\d{5}$/.test(value.postal_code) ||
    (value.type !== "locality" && value.type !== "neighborhood") || !isName(value.name) ||
    !isNullableString(value.city) || (value.city === null) !== (value.type === "locality") ||
    typeof value.province_code !== "string" || typeof value.region_code !== "string" ||
    !isNullableString(value.commune_code) || (value.type === "neighborhood" && value.commune_code !== null)) {
    throw new Error(`Invalid postal code record at index ${index}`);
  }
}

export function validatePostalData(
  rawCodes: unknown,
  rawCities: unknown,
  geography: GeographySnapshot,
): PostalData {
  if (!Array.isArray(rawCodes) || rawCodes.length === 0 || !Array.isArray(rawCities) || rawCities.length === 0) {
    throw new Error("Postal snapshots must contain records");
  }
  rawCities.forEach(assertCity);
  rawCodes.forEach(assertPostalCode);
  const sourceCities = rawCities as MultiCodeCitySource[];
  const codes = rawCodes as PostalCode[];

  const provinceByCode = new Map(geography.provinces.map((province) => [province.code, province]));
  const communeByCode = new Map(geography.communes.map((commune) => [commune.code, commune]));
  const checkGeography = (record: Omit<PostalCode, "postal_code" | "type" | "city">, label: string) => {
    if (provinceByCode.get(record.province_code)?.region_code !== record.region_code) {
      throw new Error(`Invalid postal province/region relationship for '${label}'`);
    }
    if (record.commune_code !== null && communeByCode.get(record.commune_code)?.province_code !== record.province_code) {
      throw new Error(`Invalid postal commune for '${label}'`);
    }
  };

  const cityByName = new Map<string, MultiCodeCitySource>();
  for (const city of sourceCities) {
    if (cityByName.has(city.name)) throw new Error(`Duplicate multi-code city '${city.name}'`);
    checkGeography(city, city.name);
    cityByName.set(city.name, city);
  }

  // A neighbourhood sharing a locality's code must be in that locality's province.
  const localityProvinces = new Map<string, Set<string>>();
  for (const record of codes) {
    if (record.type === "locality") {
      localityProvinces.set(record.postal_code, (localityProvinces.get(record.postal_code) ?? new Set()).add(record.province_code));
    }
  }

  const keys = new Set<string>();
  const cityCodes = new Map<string, Set<string>>();
  const cityNeighborhoods = new Map<string, number>();
  for (const record of codes) {
    const key = [record.type, record.city, record.province_code, record.name, record.postal_code].join("|");
    if (keys.has(key)) throw new Error(`Duplicate postal code record '${record.name}' (${record.postal_code})`);
    keys.add(key);
    checkGeography(record, record.name);
    if (record.city !== null) {
      const city = cityByName.get(record.city);
      if (!city || city.province_code !== record.province_code) {
        throw new Error(`Invalid multi-code city for neighborhood '${record.name}'`);
      }
      const owners = localityProvinces.get(record.postal_code);
      if (owners && !owners.has(record.province_code)) {
        throw new Error(`Neighborhood '${record.name}' uses a locality code from another province`);
      }
      cityCodes.set(record.city, (cityCodes.get(record.city) ?? new Set()).add(record.postal_code));
      cityNeighborhoods.set(record.city, (cityNeighborhoods.get(record.city) ?? 0) + 1);
    }
  }

  const cities: MultiCodeCity[] = sourceCities.map((city) => {
    const postalCodes = [...cityCodes.get(city.name) ?? []].sort();
    if (!postalCodes.length) throw new Error(`Multi-code city '${city.name}' has no neighborhoods`);
    return { ...city, postal_codes: Object.freeze(postalCodes), neighborhood_count: cityNeighborhoods.get(city.name)! };
  });

  return Object.freeze({
    postalCodes: Object.freeze(codes.map((record) => Object.freeze({ ...record }))),
    cities: Object.freeze(cities.map((city) => Object.freeze(city))),
  });
}

export async function loadPostal(geography: GeographySnapshot): Promise<PostalData> {
  const [codes, cities] = await Promise.all([readFile(codesUrl, "utf8"), readFile(citiesUrl, "utf8")]);
  return validatePostalData(JSON.parse(codes), JSON.parse(cities), geography);
}
