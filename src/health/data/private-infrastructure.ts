import { readFile } from "node:fs/promises";

import type { Region } from "../../geography/types.js";
import { privateInfrastructureIndicators } from "../indicators.js";
import type { PrivateInfrastructure } from "../types.js";
import { isRecord } from "./validation.js";

const datasetUrl = new URL("../../../data/health/private-infrastructure.json", import.meta.url);

function assertInfrastructure(value: unknown, index: number): asserts value is PrivateInfrastructure {
  if (!isRecord(value) || !(value.geographic_level === "national" || value.geographic_level === "region") ||
    !(value.region_code === null || typeof value.region_code === "string") ||
    typeof value.reference_year !== "number" || !Number.isInteger(value.reference_year) || value.reference_year < 1900 ||
    !privateInfrastructureIndicators.every((field) => {
      const count = value[field];
      return count === null || typeof count === "number" && Number.isSafeInteger(count) && count >= 0;
    })
  ) {
    throw new Error(`Invalid private infrastructure record at index ${index}`);
  }
  if (value.geographic_level === "national" &&
    (value.region_code !== null || privateInfrastructureIndicators.some((field) => value[field] === null))) {
    throw new Error(`Invalid national private infrastructure record at index ${index}`);
  }
}

export async function loadPrivateInfrastructure(regions: readonly Region[]): Promise<readonly PrivateInfrastructure[]> {
  const parsed: unknown = JSON.parse(await readFile(datasetUrl, "utf8"));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Private infrastructure dataset must contain records");
  }
  const records: PrivateInfrastructure[] = parsed.map((record: unknown, index: number) => {
    assertInfrastructure(record, index);
    return record;
  });
  const regionCodes = new Set(regions.map((region) => region.code));
  const keys = new Set<string>();
  for (const record of records) {
    if (record.geographic_level === "region" && (record.region_code === null || !regionCodes.has(record.region_code))) {
      throw new Error(`Invalid private infrastructure region '${record.region_code}'`);
    }
    const key = `${record.geographic_level}:${record.region_code}:${record.reference_year}`;
    if (keys.has(key)) throw new Error(`Duplicate private infrastructure record '${key}'`);
    keys.add(key);
  }
  return Object.freeze(records.map((record) => Object.freeze(record)));
}
