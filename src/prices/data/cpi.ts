import { readFile } from "node:fs/promises";

import type { GeographySnapshot } from "../../geography/types.js";
import type { CpiData } from "../types.js";
import { assertCpiMappings, buildCpiSnapshot, type CpiMappings, type CpiRow } from "./transform.js";

const dataUrl = new URL("../../../data/prices/", import.meta.url);

const readJson = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(name, dataUrl), "utf8"));

export async function loadCpiRows(): Promise<CpiRow[]> {
  const rows = await readJson("source/cpi-monthly.json");
  if (!Array.isArray(rows) || !rows.every((row) => Array.isArray(row) &&
    row.every((cell) => cell === null || typeof cell === "string" || typeof cell === "number"))) {
    throw new Error("Invalid CPI source rows");
  }
  return rows as CpiRow[];
}

export async function loadCpiMappings(): Promise<CpiMappings> {
  const mappings = await readJson("cpi-mappings.json");
  assertCpiMappings(mappings);
  return mappings;
}

export async function loadCpi(geography: GeographySnapshot): Promise<CpiData> {
  const [rows, mappings] = await Promise.all([loadCpiRows(), loadCpiMappings()]);
  const snapshot = buildCpiSnapshot(rows, mappings, new Set(geography.regions.map((region) => region.code)));
  return Object.freeze({
    months: Object.freeze([...snapshot.months]),
    cities: Object.freeze(snapshot.cities.map((city) => Object.freeze({ ...city }))),
    products: Object.freeze(snapshot.products.map((product) => Object.freeze({ ...product }))),
    series: Object.freeze(snapshot.series.map((item) => Object.freeze({ ...item, values: Object.freeze([...item.values]) }))),
  });
}
