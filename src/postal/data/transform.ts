import type { GeographySnapshot } from "../../geography/types.js";
import type { MultiCodeCitySource, PostalCode } from "../types.js";

/** Rows exactly as published in the Poste Maroc spreadsheets. */
export interface SourceLocality {
  REGION_POSTALE: string;
  PROVINCE: string;
  LOCALITE: string;
  "NOUVEAU CODE POSTAL": number;
}

export interface SourceCity {
  REGION_POSTALE: string;
  PROVINCE: string;
  LOCALITE: string;
}

export interface SourceNeighborhood {
  VILLE: string;
  QUARTIER: string;
  "NOUVEAU CODE POSTAL": number;
}

export interface PostalSource {
  localities: readonly SourceLocality[];
  cities: readonly SourceCity[];
  neighborhoods: readonly SourceNeighborhood[];
}

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export interface PostalMappings {
  province_aliases: Section<{ source: string; province_code: string }>;
  region_label_aliases: Section<{ source: string; region_code: string }>;
  region_corrections: Section<{
    type: PostalCode["type"];
    name: string;
    postal_code: string;
    source_region: string;
    province_code: string;
    region_code: string;
  }>;
  city_commune_aliases: Section<{ source: string; commune_code: string }>;
  excluded_neighborhoods: Section<{
    city: string;
    name: string;
    postal_code: string;
    reason: "code_of_locality_in_other_province";
    code_owner: { locality: string; province_code: string };
  }>;
}

export interface PostalSnapshot {
  codes: PostalCode[];
  cities: MultiCodeCitySource[];
  duplicatesRemoved: number;
}

/** Display value: collapses repeated and non-breaking whitespace, keeps spelling and case. */
export function clean(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Matching key: ASCII slug of the cleaned value. */
export function slug(value: string): string {
  return clean(value).normalize("NFD").replace(/[^\u0000-\u007f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isCode(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 10000 && (value as number) <= 99999;
}

function assertRows<T>(rows: unknown, keys: readonly string[], check: (row: Record<string, unknown>) => boolean, label: string): asserts rows is T[] {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`Postal source '${label}' must contain rows`);
  rows.forEach((row: unknown, index) => {
    if (!isRecord(row) || Object.keys(row).join("|") !== keys.join("|") || !check(row)) {
      throw new Error(`Invalid postal source row in '${label}' at index ${index}`);
    }
  });
}

export function assertPostalSource(value: { localities: unknown; cities: unknown; neighborhoods: unknown }): asserts value is PostalSource {
  assertRows<SourceLocality>(value.localities, ["REGION_POSTALE", "PROVINCE", "LOCALITE", "NOUVEAU CODE POSTAL"],
    (row) => isText(row.REGION_POSTALE) && isText(row.PROVINCE) && isText(row.LOCALITE) && isCode(row["NOUVEAU CODE POSTAL"]), "localities");
  assertRows<SourceCity>(value.cities, ["REGION_POSTALE", "PROVINCE", "LOCALITE"],
    (row) => isText(row.REGION_POSTALE) && isText(row.PROVINCE) && isText(row.LOCALITE), "multi-code-cities");
  assertRows<SourceNeighborhood>(value.neighborhoods, ["VILLE", "QUARTIER", "NOUVEAU CODE POSTAL"],
    (row) => isText(row.VILLE) && isText(row.QUARTIER) && isCode(row["NOUVEAU CODE POSTAL"]), "neighborhoods");
}

/** Code-point order, independent of the host locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Builds published records from the verbatim source rows and the reviewed mapping file.
 * Every mapping entry must be used, and every source disagreement must be mapped,
 * so a changed source or a stale mapping stops the build instead of being hidden.
 */
export function buildPostalSnapshot(
  source: PostalSource,
  mappings: PostalMappings,
  geography: GeographySnapshot,
): PostalSnapshot {
  const provinces = new Map(geography.provinces.map((province) => [province.code, province]));
  const regionCodes = new Set(geography.regions.map((region) => region.code));
  const communeCodes = new Set(geography.communes.map((commune) => commune.code));

  const provinceAliases = new Map(mappings.province_aliases.entries.map((entry) => [slug(entry.source), entry.province_code]));
  const regionAliases = new Map(mappings.region_label_aliases.entries.map((entry) => [slug(entry.source), entry.region_code]));
  const cityCommuneAliases = new Map(mappings.city_commune_aliases.entries.map((entry) => [slug(entry.source), entry.commune_code]));
  const used = new Set<string>();

  const provinceCode = (name: string): string => {
    const key = slug(name);
    const alias = provinceAliases.get(key);
    if (alias !== undefined) used.add(`province:${key}`);
    const code = alias ?? key;
    if (!provinces.has(code)) throw new Error(`Unmapped postal province '${clean(name)}'`);
    return code;
  };

  const corrections = new Map(mappings.region_corrections.entries.map((entry) =>
    [[entry.type, entry.name, entry.postal_code].join("|"), entry]));
  const regionCode = (label: string, province: string, key: string): string => {
    const labelKey = slug(label);
    const alias = regionAliases.get(labelKey);
    if (alias !== undefined) used.add(`region:${labelKey}`);
    const labelled = alias ?? labelKey;
    if (!regionCodes.has(labelled)) throw new Error(`Unmapped postal region label '${clean(label)}'`);
    const region = provinces.get(province)!.region_code;
    const correction = corrections.get(key);
    if (labelled !== region) {
      if (!correction || correction.source_region !== clean(label) || correction.province_code !== province ||
        correction.region_code !== region) {
        throw new Error(`Unlisted postal region disagreement for '${key}'`);
      }
      used.add(`correction:${key}`);
    } else if (correction) {
      throw new Error(`Postal region correction '${key}' does not match a disagreement`);
    }
    return region;
  };

  const communeFor = (province: string, name: string, aliases?: Map<string, string>): string | null => {
    const alias = aliases?.get(slug(name));
    if (alias !== undefined) used.add(`commune:${slug(name)}`);
    const code = alias ?? `${province}--${slug(name)}`;
    return communeCodes.has(code) ? code : null;
  };

  const codes: PostalCode[] = [];
  for (const row of source.localities) {
    const name = clean(row.LOCALITE);
    const postalCode = String(row["NOUVEAU CODE POSTAL"]);
    const province = provinceCode(row.PROVINCE);
    codes.push({
      postal_code: postalCode, type: "locality", name, city: null, province_code: province,
      region_code: regionCode(row.REGION_POSTALE, province, ["locality", name, postalCode].join("|")),
      commune_code: communeFor(province, name),
    });
  }

  const cities: MultiCodeCitySource[] = source.cities.map((row) => {
    const name = clean(row.LOCALITE);
    const province = provinceCode(row.PROVINCE);
    return {
      name, province_code: province,
      region_code: regionCode(row.REGION_POSTALE, province, ["city", name, ""].join("|")),
      commune_code: communeFor(province, name, cityCommuneAliases),
    };
  });
  const cityByName = new Map(cities.map((city) => [city.name, city]));

  const localityOwners = new Map<string, Set<string>>();
  for (const record of codes) {
    localityOwners.set(record.postal_code, (localityOwners.get(record.postal_code) ?? new Set()).add(record.province_code));
  }
  const exclusions = new Map(mappings.excluded_neighborhoods.entries.map((entry) =>
    [[entry.city, entry.name, entry.postal_code].join("|"), entry]));

  const seen = new Set<string>();
  let duplicatesRemoved = 0;
  for (const row of source.neighborhoods) {
    const cityName = clean(row.VILLE);
    const city = cityByName.get(cityName);
    if (!city) throw new Error(`Unknown postal multi-code city '${cityName}'`);
    const name = clean(row.QUARTIER);
    const postalCode = String(row["NOUVEAU CODE POSTAL"]);
    const key = [cityName, name, postalCode].join("|");
    if (seen.has(key)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(key);
    const owners = localityOwners.get(postalCode);
    const conflicting = owners !== undefined && !owners.has(city.province_code);
    const exclusion = exclusions.get(key);
    if (conflicting !== (exclusion !== undefined)) {
      throw new Error(conflicting
        ? `Unlisted postal neighbourhood conflict '${key}'`
        : `Postal exclusion '${key}' does not match a conflicting row`);
    }
    if (exclusion) {
      if (!owners!.has(exclusion.code_owner.province_code)) {
        throw new Error(`Postal exclusion '${key}' names the wrong code owner`);
      }
      used.add(`excluded:${key}`);
      continue;
    }
    codes.push({
      postal_code: postalCode, type: "neighborhood", name, city: cityName,
      province_code: city.province_code, region_code: city.region_code, commune_code: null,
    });
  }

  const expected = [
    ...[...provinceAliases.keys()].map((key) => `province:${key}`),
    ...[...regionAliases.keys()].map((key) => `region:${key}`),
    ...[...corrections.keys()].map((key) => `correction:${key}`),
    ...[...cityCommuneAliases.keys()].map((key) => `commune:${key}`),
    ...[...exclusions.keys()].map((key) => `excluded:${key}`),
  ];
  const unused = expected.filter((key) => !used.has(key));
  if (unused.length) throw new Error(`Unused postal mapping entries: ${unused.join(", ")}`);

  codes.sort((a, b) => compare(a.postal_code, b.postal_code) || compare(a.type, b.type) ||
    compare(a.city ?? "", b.city ?? "") || compare(a.name, b.name));
  cities.sort((a, b) => compare(a.name, b.name));
  return { codes, cities, duplicatesRemoved };
}
