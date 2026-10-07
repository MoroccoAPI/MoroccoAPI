import { readFile } from "node:fs/promises";

import type { HistoricalPopulation } from "../types.js";

const historicalDatasetUrl = new URL(
  "../../../data/population/historical-population.json",
  import.meta.url,
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function assertHistoricalPopulation(
  value: unknown,
  index: number,
): asserts value is HistoricalPopulation {
  if (
    !isRecord(value) ||
    !isNonNegativeSafeInteger(value.year) ||
    value.year === 0 ||
    !isNonNegativeSafeInteger(value.total) ||
    !isNonNegativeSafeInteger(value.urban) ||
    !isNonNegativeSafeInteger(value.rural) ||
    value.urban + value.rural !== value.total
  ) {
    throw new Error(`Invalid historical population record at index ${index}`);
  }
}

export async function loadHistoricalPopulation(): Promise<readonly HistoricalPopulation[]> {
  const raw = await readFile(historicalDatasetUrl, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("The historical population dataset must be a non-empty array");
  }

  parsed.forEach(assertHistoricalPopulation);

  const years = new Set<number>();
  let previousYear = 0;
  for (const record of parsed) {
    if (years.has(record.year)) {
      throw new Error(`Duplicate historical population year '${record.year}'`);
    }
    if (record.year <= previousYear) {
      throw new Error("Historical population records must be sorted by ascending year");
    }
    years.add(record.year);
    previousYear = record.year;
  }

  return Object.freeze(parsed.map((record) => Object.freeze({ ...record })));
}
