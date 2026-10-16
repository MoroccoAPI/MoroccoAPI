import { readFile } from "node:fs/promises";

import type { GeographyData, Region } from "../../geography/types.js";
import type { SubdivisionPopulation } from "../types.js";

const datasetUrl = new URL(
  "../../../data/population/subdivisions-population.json",
  import.meta.url,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

interface SourceSubdivisionPopulation {
  hcp_code: string;
  administrative_type: "province" | "prefecture";
  population: number;
  marocains: number;
  etrangers: number;
  menages: number;
  region_code: string;
}

function assertSourceRecord(
  value: unknown,
  index: number,
): asserts value is SourceSubdivisionPopulation {
  if (
    !isRecord(value) ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}\.\d{3}$/.test(value.hcp_code) ||
    (value.administrative_type !== "province" && value.administrative_type !== "prefecture") ||
    !isNonNegativeInteger(value.population) ||
    !isNonNegativeInteger(value.marocains) ||
    !isNonNegativeInteger(value.etrangers) ||
    !isNonNegativeInteger(value.menages) ||
    typeof value.region_code !== "string" ||
    value.marocains + value.etrangers !== value.population
  ) {
    throw new Error(`Invalid subdivision population record at index ${index}`);
  }
}

export async function loadSubdivisionPopulation(
  geography: GeographyData,
): Promise<readonly SubdivisionPopulation[]> {
  const raw = await readFile(datasetUrl, "utf8");
  const { provinces } = geography;
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== provinces.length) {
    throw new Error(`The subdivision population dataset must contain ${provinces.length} records`);
  }

  parsed.forEach(assertSourceRecord);
  const provincesByHcpCode = new Map(provinces.map((province) => [province.hcp_code, province]));
  const hcpCodes = new Set<string>();
  const populationByHcpCode = new Map<string, SourceSubdivisionPopulation>();

  for (const [index, record] of parsed.entries()) {
    if (hcpCodes.has(record.hcp_code)) {
      throw new Error(`Duplicate subdivision HCP code '${record.hcp_code}'`);
    }
    hcpCodes.add(record.hcp_code);

    const province = provincesByHcpCode.get(record.hcp_code);
    if (
      !province ||
      province.administrative_type !== record.administrative_type ||
      province.region_code !== record.region_code
    ) {
      throw new Error(`Subdivision population record ${index} does not match a known HCP unit`);
    }
    populationByHcpCode.set(record.hcp_code, record);
  }

  const records = provinces.map((province) => {
    const population = populationByHcpCode.get(province.hcp_code);
    if (!population) {
      throw new Error(`Missing population for subdivision HCP code '${province.hcp_code}'`);
    }
    return Object.freeze({
      ...province,
      name: Object.freeze({ ...province.name }),
      population: population.population,
      moroccans: population.marocains,
      foreigners: population.etrangers,
      households: population.menages,
    });
  });

  return Object.freeze(records);
}
