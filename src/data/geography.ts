import { readFile } from "node:fs/promises";

import type {
  Commune,
  PendingDatasetMeta,
  Province,
  Region,
  SourceLanguageName,
} from "../types.js";

const provincesDatasetUrl = new URL(
  "../../data/administrative-provinces.json",
  import.meta.url,
);
const communesDatasetUrl = new URL(
  "../../data/administrative-communes.json",
  import.meta.url,
);
const codePattern = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertSourceLanguageName(
  value: unknown,
  label: string,
  index: number,
): asserts value is SourceLanguageName {
  if (
    !isRecord(value) ||
    typeof value.fr !== "string" ||
    value.fr.trim() === "" ||
    value.ar !== null ||
    value.en !== null
  ) {
    throw new Error(`Invalid ${label} name at index ${index}`);
  }
}

function assertProvince(value: unknown, index: number): asserts value is Province {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    !codePattern.test(value.code) ||
    value.type !== "province_or_prefecture" ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid province record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "province", index);
}

function assertCommune(value: unknown, index: number): asserts value is Commune {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    !codePattern.test(value.code) ||
    value.type !== "commune" ||
    typeof value.province_code !== "string" ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid commune record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "commune", index);
}

function assertUniqueCodes(records: readonly { code: string }[], label: string): void {
  if (new Set(records.map((record) => record.code)).size !== records.length) {
    throw new Error(`${label} codes must be unique`);
  }
}

function freezeRecords<T extends { name: SourceLanguageName }>(
  records: readonly T[],
): readonly T[] {
  return Object.freeze(
    records.map((record) =>
      Object.freeze({ ...record, name: Object.freeze({ ...record.name }) }),
    ),
  );
}

export interface GeographyData {
  provinces: readonly Province[];
  communes: readonly Commune[];
}

export async function loadGeography(
  regions: readonly Region[],
): Promise<GeographyData> {
  const [rawProvinces, rawCommunes] = await Promise.all([
    readFile(provincesDatasetUrl, "utf8"),
    readFile(communesDatasetUrl, "utf8"),
  ]);
  const parsedProvinces: unknown = JSON.parse(rawProvinces);
  const parsedCommunes: unknown = JSON.parse(rawCommunes);

  if (!Array.isArray(parsedProvinces) || parsedProvinces.length !== 75) {
    throw new Error("The provinces dataset must contain exactly 75 records");
  }
  if (!Array.isArray(parsedCommunes) || parsedCommunes.length !== 1539) {
    throw new Error("The communes dataset must contain exactly 1539 records");
  }

  parsedProvinces.forEach(assertProvince);
  parsedCommunes.forEach(assertCommune);
  assertUniqueCodes(parsedProvinces, "Province");
  assertUniqueCodes(parsedCommunes, "Commune");

  const regionCodes = new Set(regions.map((region) => region.code));
  const provinceRegions = new Map(
    parsedProvinces.map((province) => [province.code, province.region_code]),
  );

  for (const province of parsedProvinces) {
    if (!regionCodes.has(province.region_code)) {
      throw new Error(`Unknown region code '${province.region_code}' for ${province.code}`);
    }
  }

  for (const commune of parsedCommunes) {
    const provinceRegionCode = provinceRegions.get(commune.province_code);
    if (!provinceRegionCode) {
      throw new Error(
        `Unknown province code '${commune.province_code}' for ${commune.code}`,
      );
    }
    if (provinceRegionCode !== commune.region_code) {
      throw new Error(`Region mismatch for commune '${commune.code}'`);
    }
  }

  return {
    provinces: freezeRecords(parsedProvinces),
    communes: freezeRecords(parsedCommunes),
  };
}

export function buildPendingDatasetMeta(
  dataset: PendingDatasetMeta["dataset"],
  total: number,
): PendingDatasetMeta {
  return {
    dataset,
    total,
    license: null,
    retrieved_at: "2026-09-24",
    transformation_version: "1.0.0",
    sources: [
      {
        dataset: "Administrative geography",
        producer: "Haut-Commissariat au Plan (HCP)",
        source_url: null,
        resource_url: null,
        license: null,
        source_updated_at: null,
      },
    ],
    review_status: "pending",
  };
}
