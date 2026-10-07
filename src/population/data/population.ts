import { readFile } from "node:fs/promises";
import type { NationalPopulation, PopulationBreakdown } from "../types.js";

const nationalDatasetURL = new URL("../../../data/population/national-population.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBreakdown(value: unknown): value is PopulationBreakdown {
  return isRecord(value) &&
    Number.isSafeInteger(value.total) && (value.total as number) >= 0 &&
    Number.isSafeInteger(value.moroccans) && (value.moroccans as number) >= 0 &&
    Number.isSafeInteger(value.foreigners) && (value.foreigners as number) >= 0 &&
    (value.moroccans as number) + (value.foreigners as number) === value.total;
}

function assertNationalPopulation(value: unknown): asserts value is NationalPopulation {
  if (!isRecord(value)) {
    throw new Error("Invalid national population dataset");
  }

  const urban = value.urban;
  const rural = value.rural;
  if (
    !isBreakdown(value) ||
    !isBreakdown(urban) ||
    !isBreakdown(rural) ||
    urban.total + rural.total !== value.total ||
    urban.moroccans + rural.moroccans !== value.moroccans ||
    urban.foreigners + rural.foreigners !== value.foreigners
  ) {
    throw new Error("Invalid national population dataset");
  }
}

export async function loadNationalPopulation(): Promise<NationalPopulation> {
  const raw = await readFile(nationalDatasetURL, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length !== 1) {
    throw new Error("The national population dataset must contain exactly one record");
  }
  const record: unknown = parsed[0];
  assertNationalPopulation(record);
  return Object.freeze({
    ...record,
    urban: Object.freeze({ ...record.urban }),
    rural: Object.freeze({ ...record.rural }),
  });
}
