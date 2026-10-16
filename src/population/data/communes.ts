import { readFile } from "node:fs/promises";

import type { GeographyData } from "../../geography/types.js";
import type { CommunePopulation } from "../types.js";

const datasetUrl = new URL(
  "../../../data/population/communes-population.json",
  import.meta.url,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

interface SourceCommunePopulation {
  hcp_code: string;
  type: "commune";
  population: number;
  marocains: number;
  etrangers: number;
  menages: number;
  cercle_hcp_code: string | null;
  province_code: string;
  region_code: string;
}

function assertSourceRecord(
  value: unknown,
  index: number,
): asserts value is SourceCommunePopulation {
  if (
    !isRecord(value) ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}\.\d{2}\.\d{1,2}$/.test(value.hcp_code) ||
    value.type !== "commune" ||
    !isNonNegativeInteger(value.population) ||
    !isNonNegativeInteger(value.marocains) ||
    !isNonNegativeInteger(value.etrangers) ||
    !isNonNegativeInteger(value.menages) ||
    (value.cercle_hcp_code !== null &&
      (typeof value.cercle_hcp_code !== "string" ||
        !/^\d{2}\.\d{3}\.\d{2}$/.test(value.cercle_hcp_code))) ||
    typeof value.province_code !== "string" ||
    typeof value.region_code !== "string" ||
    value.marocains + value.etrangers !== value.population
  ) {
    throw new Error(`Invalid commune population record at index ${index}`);
  }
}

export async function loadCommunePopulation(
  geography: GeographyData,
): Promise<readonly CommunePopulation[]> {
  const raw = await readFile(datasetUrl, "utf8");
  const { communes } = geography;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== communes.length) {
    throw new Error(`The commune population dataset must contain ${communes.length} records`);
  }

  parsed.forEach(assertSourceRecord);
  const communesByHcpCode = new Map(communes.map((commune) => [commune.hcp_code, commune]));
  const hcpCodes = new Set<string>();
  const populationByHcpCode = new Map<string, SourceCommunePopulation>();

  for (const [index, record] of parsed.entries()) {
    if (hcpCodes.has(record.hcp_code)) {
      throw new Error(`Duplicate commune HCP code '${record.hcp_code}'`);
    }
    hcpCodes.add(record.hcp_code);

    const commune = communesByHcpCode.get(record.hcp_code);
    if (
      !commune ||
      commune.type !== record.type ||
      commune.province_code !== record.province_code ||
      commune.region_code !== record.region_code ||
      commune.cercle_hcp_code !== record.cercle_hcp_code
    ) {
      throw new Error(`Commune population record ${index} does not match a known HCP commune`);
    }
    populationByHcpCode.set(record.hcp_code, record);
  }

  const records = communes.map((commune) => {
    const population = populationByHcpCode.get(commune.hcp_code);
    if (!population) {
      throw new Error(`Missing population for commune HCP code '${commune.hcp_code}'`);
    }
    return Object.freeze({
      ...commune,
      name: Object.freeze({ ...commune.name }),
      population: population.population,
      moroccans: population.marocains,
      foreigners: population.etrangers,
      households: population.menages,
    });
  });

  return Object.freeze(records);
}
