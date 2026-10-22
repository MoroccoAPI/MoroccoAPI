import { readFile } from "node:fs/promises";

import type { GeographySnapshot } from "../../../geography/types.js";
import type { PopulationIndicatorsData } from "../types.js";
import {
  assertIndicatorMappings, buildIndicatorSnapshot, type ExistingPopulation, type SourceRows,
} from "./transform.js";

const dataUrl = new URL("../../../../data/population/", import.meta.url);

function assertRows(value: unknown, name: string): asserts value is unknown[][] {
  if (!Array.isArray(value) || value.length < 3 || !value.every(Array.isArray)) {
    throw new Error(`The ${name} source file must contain rows of cells`);
  }
}

export async function loadPopulationIndicators(
  geography: GeographySnapshot,
  existing: ExistingPopulation,
): Promise<PopulationIndicatorsData> {
  const read = async (name: string) => JSON.parse(await readFile(new URL(name, dataUrl), "utf8")) as unknown;
  const [population, households, mappings] = await Promise.all([
    read("source/rgph-2024-indicators-population.json"),
    read("source/rgph-2024-indicators-households.json"),
    read("indicators-mappings.json"),
  ]);
  assertRows(population, "population");
  assertRows(households, "households");
  assertIndicatorMappings(mappings);
  const rows: SourceRows = { population, households };
  const snapshot = buildIndicatorSnapshot(rows, mappings, geography, existing);
  return Object.freeze({
    groups: Object.freeze(snapshot.groups.map((group) => Object.freeze({ ...group, name: Object.freeze(group.name) }))),
    indicators: Object.freeze(snapshot.indicators.map((indicator) => Object.freeze({
      ...indicator, name: Object.freeze(indicator.name), sexes: Object.freeze([...indicator.sexes]),
    }))),
    territories: Object.freeze(snapshot.territories.map((territory) => Object.freeze({
      ...territory, name: Object.freeze(territory.name),
    }))),
    values: Object.freeze(snapshot.values.map((row) => Object.freeze(row.map((value) => Object.freeze({
      ...value, null_reasons: Object.freeze(value.null_reasons),
    }))))),
    excluded: Object.freeze({ ...snapshot.excluded }),
  });
}
