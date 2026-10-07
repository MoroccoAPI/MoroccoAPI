import { readFile } from "node:fs/promises";

import { loadRegions } from "../../geography/data/regions.js";
import type { RegionPopulation } from "../types.js";

const datasetUrl = new URL("../../../data/population/region-population.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function assertRegionPopulation(value: unknown, index: number): asserts value is RegionPopulation {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.hcp_code !== "string" ||
    value.type !== "region" ||
    !isRecord(value.name) ||
    typeof value.name.ar !== "string" ||
    typeof value.name.fr !== "string" ||
    typeof value.name.en !== "string" ||
    !isNonNegativeInteger(value.population) ||
    !isNonNegativeInteger(value.moroccans) ||
    !isNonNegativeInteger(value.foreigners) ||
    !isNonNegativeInteger(value.urban) ||
    !isNonNegativeInteger(value.rural) ||
    value.moroccans + value.foreigners !== value.population ||
    value.urban + value.rural !== value.population
  ) {
    throw new Error(`Invalid regional population record at index ${index}`);
  }
}

export async function loadRegionPopulation(): Promise<readonly RegionPopulation[]> {
  const [raw, regions] = await Promise.all([
    readFile(datasetUrl, "utf8"),
    loadRegions(),
  ]);
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== regions.length) {
    throw new Error(`The regional population dataset must contain ${regions.length} records`);
  }

  parsed.forEach(assertRegionPopulation);
  const regionsByCode = new Map(regions.map((region) => [region.code, region]));
  const codes = new Set<string>();

  for (const [index, record] of parsed.entries()) {
    if (codes.has(record.code)) {
      throw new Error(`Duplicate regional population code '${record.code}'`);
    }
    codes.add(record.code);

    const region = regionsByCode.get(record.code);
    if (
      !region ||
      region.hcp_code !== record.hcp_code
    ) {
      throw new Error(`Regional population record ${index} does not match a known region code and HCP code`);
    }
  }

  return Object.freeze(
    parsed.map((record) => Object.freeze({ ...record, name: Object.freeze({ ...record.name }) })),
  );
}
