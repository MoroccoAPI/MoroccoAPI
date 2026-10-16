import { readFile } from "node:fs/promises";

import { isObservationDate } from "./dates.js";
import type { Dam, DamBasin, DamData, DamLevel, DamManifest } from "./types.js";

const baseUrl = new URL("../../data/dams/", import.meta.url);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const nationalSourceId = "maadialna-2026-10-12";
const historicalDamIds = [
  "abou-el-abess-sebti", "bge-my-abdrhmane", "lalla-takerkoust",
  "sd-mohamed-ben-slimane-el-jazouli", "yacoub-el-mansour",
];
const nationalBasins: Record<string, { basin: DamBasin; dams: readonly string[] }> = {
  MH1: { basin: "moulouya", dams: ["hassan-ii", "mohammed-v"] },
  MH2: { basin: "loukkos", dams: ["oued-el-makhazine", "charif-al-idrissi", "dar-khrofa"] },
  MH3: { basin: "sebou", dams: ["al-wahda", "idriss-i", "asfalou"] },
  MH4: { basin: "guir-ziz-gheris", dams: ["hassan-addakhil", "kaddoussa"] },
  MH5: { basin: "bouregreg", dams: ["sidi-mohamed-ben-abdellah", "tiddas"] },
  MH6: { basin: "oum-er-rbia", dams: ["bin-el-ouidane", "al-massira", "ahmed-el-hansali"] },
  MH7: { basin: "tensift", dams: ["bge-my-abdrhmane", "yacoub-el-mansour"] },
  MH8: { basin: "souss-massa", dams: ["youssef-ben-tachfine", "abdelmoumen", "moulay-abdellah"] },
  MH9: { basin: "draa-oued-noun", dams: ["mansour-eddahbi", "sultan-moulay-ali-cherif"] },
};
const expectedDamBasins = new Map<string, DamBasin>([
  ...historicalDamIds.map((id) => [id, "tensift"] as [string, DamBasin]),
  ...Object.values(nationalBasins).flatMap(({ basin, dams }) => dams.map((id) => [id, basin] as [string, DamBasin])),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSourceUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isSourceDate(value: unknown): value is string | null {
  if (value === null || isObservationDate(value)) return true;
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z?$/.test(value) &&
    isObservationDate(value.slice(0, 10));
}

function freezeTree<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function validateDamData(rawDams: unknown, rawLevels: unknown, rawManifest: unknown): DamData {
  if (!isRecord(rawManifest) || rawManifest.id !== "morocco-dams" ||
      !nonEmpty(rawManifest.title) || !nonEmpty(rawManifest.producer) ||
      (rawManifest.source_url !== null && !isSourceUrl(rawManifest.source_url)) ||
      rawManifest.source_license !== "mixed" || rawManifest.license_url !== null ||
      !isObservationDate(rawManifest.retrieved_at) || !isSourceDate(rawManifest.source_updated_at) ||
      !nonEmpty(rawManifest.transformation_version) ||
      !Array.isArray(rawManifest.resources) || rawManifest.resources.length !== 3) {
    throw new Error("Invalid Morocco dam source manifest");
  }
  const sourceIds = new Set<string>();
  const sourceSheets = new Map<string, string>();
  for (const source of rawManifest.resources) {
    if (!isRecord(source) || !nonEmpty(source.id) || !slugPattern.test(source.id) ||
        sourceIds.has(source.id) || !isSourceUrl(source.resource_url) ||
        !nonEmpty(source.title) || !nonEmpty(source.producer) || !isSourceUrl(source.source_url) ||
        !isSourceDate(source.source_updated_at)) {
      throw new Error("Invalid or duplicate dam source");
    }
    if (source.id === nationalSourceId) {
      if (source.license !== null || source.license_url !== null || source.period !== "2026-10" ||
          source.sheet !== null || source.source_date !== "2026-10-12" ||
          source.date_basis !== "dashboard_headline" || source.source_updated_at !== null) {
        throw new Error("Invalid Maadialna source license or snapshot date basis");
      }
    } else {
      if ((source.period !== "2026-08" && source.period !== "2026-09") ||
          source.id !== `abht-tensift-${source.period}` ||
          source.sheet !== (source.period === "2026-08" ? "Août_2026" : "Sept_2026") ||
          source.license !== "ODbL-1.0" || !isSourceUrl(source.license_url) ||
          (source.date_basis !== undefined && source.date_basis !== "source_calendar")) {
        throw new Error("Invalid Tensift dam source");
      }
      sourceSheets.set(source.id, source.sheet as string);
    }
    sourceIds.add(source.id);
  }
  if (!sourceIds.has(nationalSourceId) || !sourceIds.has("abht-tensift-2026-08") || !sourceIds.has("abht-tensift-2026-09")) {
    throw new Error("Missing dam source");
  }

  if (!Array.isArray(rawDams) || rawDams.length !== 25 ||
      !Array.isArray(rawLevels) || rawLevels.length !== 327) {
    throw new Error("Morocco snapshot must contain 25 selected dams and 327 observations");
  }
  const damIds = new Set<string>();
  for (const dam of rawDams) {
    if (!isRecord(dam) || !nonEmpty(dam.id) || !slugPattern.test(dam.id) || damIds.has(dam.id) || !expectedDamBasins.has(dam.id) ||
        dam.basin !== expectedDamBasins.get(dam.id) || !isRecord(dam.name) ||
        (dam.name.fr !== null && !nonEmpty(dam.name.fr)) ||
        (dam.name.ar !== undefined && !nonEmpty(dam.name.ar)) ||
        (historicalDamIds.includes(dam.id) ? !nonEmpty(dam.name.fr) : dam.name.fr !== null || !nonEmpty(dam.name.ar))) {
      throw new Error("Invalid or duplicate dam");
    }
    damIds.add(dam.id);
  }

  const observations = new Set<string>();
  const historicalDates = new Map<string, Set<string>>();
  let nationalCount = 0;
  for (const level of rawLevels) {
    if (!isRecord(level) || typeof level.dam_id !== "string" || !damIds.has(level.dam_id) ||
        !isObservationDate(level.date) || level.date > rawManifest.retrieved_at ||
        !isNonNegative(level.volume_mm3) || !isNonNegative(level.filling_rate_pct) ||
        typeof level.source_id !== "string" || !sourceIds.has(level.source_id) ||
        !isRecord(level.source_ref) || Object.keys(level.source_ref).length !== 2) {
      throw new Error("Invalid dam observation or source reference");
    }
    if (level.source_id === nationalSourceId) {
      const { basin_code: basinCode, dam_index: damIndex } = level.source_ref;
      const sourceBasin = typeof basinCode === "string" ? nationalBasins[basinCode] : undefined;
      if (level.date !== "2026-10-12" || level.date_basis !== "dashboard_headline" ||
          level.capacity_mm3 !== null ||
          (level.previous_year_filling_rate_pct !== null && !isNonNegative(level.previous_year_filling_rate_pct)) ||
          !sourceBasin || typeof damIndex !== "number" || !Number.isInteger(damIndex) || damIndex < 1 ||
          sourceBasin.dams[damIndex - 1] !== level.dam_id) {
        throw new Error("Invalid Maadialna observation, comparison or source reference");
      }
      nationalCount += 1;
    } else {
      if (!historicalDamIds.includes(level.dam_id) || level.date < "2026-08-01" || level.date > "2026-09-30" ||
          !isNonNegative(level.capacity_mm3) || level.capacity_mm3 === 0 ||
          (level.date_basis !== undefined && level.date_basis !== "source_calendar") ||
          level.previous_year_filling_rate_pct !== undefined ||
          level.source_id !== `abht-tensift-${level.date.slice(0, 7)}` ||
          level.source_ref.sheet !== sourceSheets.get(level.source_id) ||
          level.source_ref.row !== Number(level.date.slice(8, 10)) + 3) {
        throw new Error("Invalid Tensift daily observation or source reference");
      }
      if (Math.abs(level.volume_mm3 / level.capacity_mm3 * 100 - level.filling_rate_pct) > 1e-8) {
        throw new Error("Inconsistent Tensift volume, capacity and filling percentage");
      }
      const dates = historicalDates.get(level.dam_id) ?? new Set<string>();
      dates.add(level.date);
      historicalDates.set(level.dam_id, dates);
    }
    const key = `${level.dam_id}:${level.date}`;
    if (observations.has(key)) throw new Error("Duplicate dam/date observation");
    observations.add(key);
  }
  if (nationalCount !== 22 || historicalDamIds.some((id) => historicalDates.get(id)?.size !== 61)) {
    throw new Error("Snapshot must preserve all 305 Tensift daily observations and 22 Maadialna observations");
  }

  return freezeTree({
    dams: structuredClone(rawDams) as Dam[],
    levels: rawLevels.map((level) => ({ ...structuredClone(level), date_basis: level.date_basis ?? "source_calendar" })) as DamLevel[],
    manifest: structuredClone(rawManifest) as unknown as DamManifest,
  });
}

export async function loadDams(): Promise<DamData> {
  const [dams, levels, manifest] = await Promise.all(
    ["dams.json", "levels.json", "sources.json"].map(async (name) =>
      JSON.parse(await readFile(new URL(name, baseUrl), "utf8")) as unknown),
  );
  return validateDamData(dams, levels, manifest);
}
