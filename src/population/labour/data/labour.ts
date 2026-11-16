import { readFile } from "node:fs/promises";

import type { GeographySnapshot } from "../../../geography/types.js";
import { LABOUR_FIELDS, type LabourData } from "../types.js";
import { assertLabourMappings, buildLabourSnapshot, type LabourMappings, type LabourRow, type LabourRows } from "./transform.js";

const dataUrl = new URL("../../../../data/population/", import.meta.url);

const readJson = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(name, dataUrl), "utf8"));

export async function loadLabourMappings(): Promise<LabourMappings> {
  const mappings = await readJson("labour-mappings.json");
  assertLabourMappings(mappings);
  return mappings;
}

export async function loadLabourRows(mappings: LabourMappings): Promise<LabourRows> {
  const files = await Promise.all(LABOUR_FIELDS.map(async (field) => {
    const sheet = mappings.sheets.entries.find((entry) => entry.field === field);
    if (!sheet || !/^source\/labour-[a-z]+-rate\.json$/.test(sheet.file)) {
      throw new Error(`The labour mapping file must name the ${field} source file`);
    }
    const rows = await readJson(sheet.file);
    if (!Array.isArray(rows) || !rows.every((row) => Array.isArray(row) &&
      row.every((cell) => cell === null || typeof cell === "string" || typeof cell === "number"))) {
      throw new Error(`Invalid ${field} source rows`);
    }
    return [field, rows as LabourRow[]] as const;
  }));
  return Object.fromEntries(files) as unknown as LabourRows;
}

export async function loadLabourData(geography: GeographySnapshot): Promise<LabourData> {
  const mappings = await loadLabourMappings();
  const snapshot = buildLabourSnapshot(await loadLabourRows(mappings), mappings, geography);
  return Object.freeze({
    years: Object.freeze(snapshot.years),
    observations: Object.freeze(snapshot.observations.map((observation) => Object.freeze({
      ...observation, name: Object.freeze(observation.name),
    }))),
  });
}
