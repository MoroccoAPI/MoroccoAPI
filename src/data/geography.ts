import { readFile } from "node:fs/promises";

import type {
  Arrondissement,
  Commune,
  GeographyDatasetMeta,
  PrefectureOfArrondissements,
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
const prefecturesOfArrondissementsDatasetUrl = new URL(
  "../../data/administrative-prefectures-of-arrondissements.json",
  import.meta.url,
);
const arrondissementsDatasetUrl = new URL(
  "../../data/administrative-arrondissements.json",
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
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label} name at index ${index}`);
  }
  if (
    typeof value.fr !== "string" ||
    value.fr.trim() === "" ||
    typeof value.ar !== "string" ||
    value.ar.trim() === "" ||
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
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}$/.test(value.hcp_code) ||
    value.type !== "province_or_prefecture" ||
    (value.administrative_type !== "province" &&
      value.administrative_type !== "prefecture") ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid province record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "province", index);
}

function assertPrefectureOfArrondissements(
  value: unknown,
  index: number,
): asserts value is PrefectureOfArrondissements {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    !codePattern.test(value.code) ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}\.\d{2}\.\d{2}$/.test(value.hcp_code) ||
    value.type !== "prefecture_of_arrondissements" ||
    typeof value.province_code !== "string" ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid prefecture of arrondissements record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "prefecture of arrondissements", index);
}

function assertCommune(value: unknown, index: number): asserts value is Commune {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    !codePattern.test(value.code) ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}\.\d{2}\.\d{1,2}$/.test(value.hcp_code) ||
    value.type !== "commune" ||
    (value.cercle_hcp_code !== null &&
      (typeof value.cercle_hcp_code !== "string" ||
        !/^\d{2}\.\d{3}\.\d{2}$/.test(value.cercle_hcp_code))) ||
    typeof value.province_code !== "string" ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid commune record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "commune", index);
}

function assertArrondissement(
  value: unknown,
  index: number,
): asserts value is Arrondissement {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    !codePattern.test(value.code) ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}\.\d{2}\.\d{2}$/.test(value.hcp_code) ||
    value.type !== "arrondissement" ||
    typeof value.commune_code !== "string" ||
    (value.prefecture_of_arrondissements_code !== null &&
      typeof value.prefecture_of_arrondissements_code !== "string") ||
    typeof value.province_code !== "string" ||
    typeof value.region_code !== "string"
  ) {
    throw new Error(`Invalid arrondissement record at index ${index}`);
  }
  assertSourceLanguageName(value.name, "arrondissement", index);
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
  prefecturesOfArrondissements: readonly PrefectureOfArrondissements[];
  communes: readonly Commune[];
  arrondissements: readonly Arrondissement[];
}

export async function loadGeography(
  regions: readonly Region[],
): Promise<GeographyData> {
  const [
    rawProvinces,
    rawPrefecturesOfArrondissements,
    rawCommunes,
    rawArrondissements,
  ] = await Promise.all([
    readFile(provincesDatasetUrl, "utf8"),
    readFile(prefecturesOfArrondissementsDatasetUrl, "utf8"),
    readFile(communesDatasetUrl, "utf8"),
    readFile(arrondissementsDatasetUrl, "utf8"),
  ]);
  const parsedProvinces: unknown = JSON.parse(rawProvinces);
  const parsedPrefecturesOfArrondissements: unknown = JSON.parse(
    rawPrefecturesOfArrondissements,
  );
  const parsedCommunes: unknown = JSON.parse(rawCommunes);
  const parsedArrondissements: unknown = JSON.parse(rawArrondissements);

  if (!Array.isArray(parsedProvinces) || parsedProvinces.length !== 75) {
    throw new Error("The provinces dataset must contain exactly 75 records");
  }
  if (
    !Array.isArray(parsedPrefecturesOfArrondissements) ||
    parsedPrefecturesOfArrondissements.length !== 8
  ) {
    throw new Error(
      "The prefectures of arrondissements dataset must contain exactly 8 records",
    );
  }
  if (!Array.isArray(parsedCommunes) || parsedCommunes.length !== 1503) {
    throw new Error("The communes dataset must contain exactly 1503 records");
  }
  if (!Array.isArray(parsedArrondissements) || parsedArrondissements.length !== 41) {
    throw new Error("The arrondissements dataset must contain exactly 41 records");
  }

  parsedProvinces.forEach(assertProvince);
  parsedPrefecturesOfArrondissements.forEach(assertPrefectureOfArrondissements);
  parsedCommunes.forEach(assertCommune);
  parsedArrondissements.forEach(assertArrondissement);
  assertUniqueCodes(parsedProvinces, "Province");
  assertUniqueCodes(
    parsedPrefecturesOfArrondissements,
    "Prefecture of arrondissements",
  );
  assertUniqueCodes(parsedCommunes, "Commune");
  assertUniqueCodes(parsedArrondissements, "Arrondissement");
  if (
    new Set(parsedProvinces.map((province) => province.hcp_code)).size !==
    parsedProvinces.length
  ) {
    throw new Error("HCP province and prefecture codes must be unique");
  }
  const allHcpCodes = [
    ...parsedProvinces,
    ...parsedPrefecturesOfArrondissements,
    ...parsedCommunes,
    ...parsedArrondissements,
  ].map((record) => record.hcp_code);
  if (new Set(allHcpCodes).size !== allHcpCodes.length) {
    throw new Error("HCP administrative codes must be unique across datasets");
  }

  const regionCodes = new Set(regions.map((region) => region.code));
  const provinceRegions = new Map(
    parsedProvinces.map((province) => [province.code, province.region_code]),
  );

  for (const province of parsedProvinces) {
    if (!regionCodes.has(province.region_code)) {
      throw new Error(`Unknown region code '${province.region_code}' for ${province.code}`);
    }
  }

  for (const prefecture of parsedPrefecturesOfArrondissements) {
    const provinceRegionCode = provinceRegions.get(prefecture.province_code);
    if (!provinceRegionCode) {
      throw new Error(
        `Unknown province code '${prefecture.province_code}' for ${prefecture.code}`,
      );
    }
    if (provinceRegionCode !== prefecture.region_code) {
      throw new Error(
        `Region mismatch for prefecture of arrondissements '${prefecture.code}'`,
      );
    }
    const province = parsedProvinces.find(
      (candidate) => candidate.code === prefecture.province_code,
    );
    if (!province || !prefecture.hcp_code.startsWith(`${province.hcp_code}.`)) {
      throw new Error(
        `HCP parent mismatch for prefecture of arrondissements '${prefecture.code}'`,
      );
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
    const province = parsedProvinces.find(
      (candidate) => candidate.code === commune.province_code,
    );
    if (!province || !commune.hcp_code.startsWith(`${province.hcp_code}.`)) {
      throw new Error(`HCP parent mismatch for commune '${commune.code}'`);
    }
    if (
      commune.cercle_hcp_code !== null &&
      !commune.cercle_hcp_code.startsWith(`${province.hcp_code}.`)
    ) {
      throw new Error(`HCP cercle mismatch for commune '${commune.code}'`);
    }
  }

  const communesByCode = new Map(
    parsedCommunes.map((commune) => [commune.code, commune]),
  );
  const prefecturesOfArrondissementsByCode = new Map(
    parsedPrefecturesOfArrondissements.map((prefecture) => [
      prefecture.code,
      prefecture,
    ]),
  );
  for (const arrondissement of parsedArrondissements) {
    const commune = communesByCode.get(arrondissement.commune_code);
    if (!commune) {
      throw new Error(
        `Unknown parent commune '${arrondissement.commune_code}' for ${arrondissement.code}`,
      );
    }
    if (
      commune.province_code !== arrondissement.province_code ||
      commune.region_code !== arrondissement.region_code
    ) {
      throw new Error(`Parent mismatch for arrondissement '${arrondissement.code}'`);
    }
    const province = parsedProvinces.find(
      (candidate) => candidate.code === arrondissement.province_code,
    );
    if (!province || !arrondissement.hcp_code.startsWith(`${province.hcp_code}.`)) {
      throw new Error(`HCP parent mismatch for arrondissement '${arrondissement.code}'`);
    }
    const prefectureCode = arrondissement.prefecture_of_arrondissements_code;
    if (prefectureCode !== null) {
      const prefecture = prefecturesOfArrondissementsByCode.get(prefectureCode);
      if (!prefecture) {
        throw new Error(
          `Unknown prefecture of arrondissements '${prefectureCode}' for ${arrondissement.code}`,
        );
      }
      if (
        prefecture.province_code !== arrondissement.province_code ||
        prefecture.region_code !== arrondissement.region_code
      ) {
        throw new Error(
          `Prefecture parent mismatch for arrondissement '${arrondissement.code}'`,
        );
      }
    }
  }

  const referencedPrefectures = new Set(
    parsedArrondissements
      .map((arrondissement) => arrondissement.prefecture_of_arrondissements_code)
      .filter((code): code is string => code !== null),
  );
  if (
    referencedPrefectures.size !== parsedPrefecturesOfArrondissements.length ||
    parsedPrefecturesOfArrondissements.some(
      (prefecture) => !referencedPrefectures.has(prefecture.code),
    )
  ) {
    throw new Error("Every prefecture of arrondissements must have a child");
  }

  return {
    provinces: freezeRecords(parsedProvinces),
    prefecturesOfArrondissements: freezeRecords(
      parsedPrefecturesOfArrondissements,
    ),
    communes: freezeRecords(parsedCommunes),
    arrondissements: freezeRecords(parsedArrondissements),
  };
}

export function buildGeographyDatasetMeta(
  dataset: GeographyDatasetMeta["dataset"],
  total: number,
): GeographyDatasetMeta {
  return {
    dataset,
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-09-26",
    transformation_version: "3.0.0",
    sources: [
      {
        dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
        producer: "Haut-Commissariat au Plan (HCP)",
        source_url:
          "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
        resource_url: "https://www.hcp.ma/file/242341/",
        license: "CC-BY-4.0",
        source_updated_at: "2024-11-22",
      },
    ],
  };
}
