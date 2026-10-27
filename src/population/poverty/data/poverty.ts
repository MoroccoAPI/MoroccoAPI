import { readFile } from "node:fs/promises";

import type { GeographySnapshot } from "../../../geography/types.js";
import { POVERTY_AREAS, type PovertyData } from "../types.js";
import { assertPovertyMappings, buildPovertySnapshot, type PovertyRows } from "./transform.js";

const dataUrl = new URL("../../../../data/population/", import.meta.url);

function assertRows(value: unknown, name: string): asserts value is unknown[][] {
  if (!Array.isArray(value) || value.length < 10 || !value.every(Array.isArray)) {
    throw new Error(`The ${name} poverty source file must contain rows of cells`);
  }
}

export async function loadPovertyMappings() {
  const mappings: unknown = JSON.parse(await readFile(new URL("poverty-mappings.json", dataUrl), "utf8"));
  assertPovertyMappings(mappings);
  return mappings;
}

export async function loadPovertyRows(): Promise<PovertyRows> {
  const files = await Promise.all(POVERTY_AREAS.map(async (area) => {
    const rows: unknown = JSON.parse(await readFile(new URL(`source/multidimensional-poverty-${area}.json`, dataUrl), "utf8"));
    assertRows(rows, area);
    return [area, rows] as const;
  }));
  return Object.fromEntries(files) as unknown as PovertyRows;
}

export async function loadPovertyData(geography: GeographySnapshot): Promise<PovertyData> {
  const [mappings, rows] = await Promise.all([loadPovertyMappings(), loadPovertyRows()]);
  if (mappings.sheets.entries.some((sheet) => sheet.file !== `source/multidimensional-poverty-${sheet.area}.json`)) {
    throw new Error("The poverty mapping file must name each area's source file");
  }
  const snapshot = buildPovertySnapshot(rows, mappings, geography);
  return Object.freeze({
    territories: Object.freeze(snapshot.territories.map((territory) => Object.freeze({
      ...territory, name: Object.freeze(territory.name),
    }))),
    observations: Object.freeze(snapshot.observations.map((list) => Object.freeze(list.map((observation) => Object.freeze({
      ...observation, deprivation_rates: Object.freeze(observation.deprivation_rates),
    }))))),
    excluded: Object.freeze({ ...snapshot.excluded }),
  });
}
