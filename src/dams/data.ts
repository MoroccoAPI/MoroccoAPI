import { readFile } from "node:fs/promises";

import { isObservationDate } from "./dates.js";
import type { Dam, DamData, DamLevel, DamManifest } from "./types.js";

const baseUrl = new URL("../../data/dams/", import.meta.url);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
  if (!isRecord(rawManifest) || rawManifest.id !== "tensift-dams" ||
      !nonEmpty(rawManifest.title) || !nonEmpty(rawManifest.producer) ||
      !isSourceUrl(rawManifest.source_url) || rawManifest.source_license !== "ODbL-1.0" ||
      !isSourceUrl(rawManifest.license_url) || !isObservationDate(rawManifest.retrieved_at) ||
      !isSourceDate(rawManifest.source_updated_at) ||
      !nonEmpty(rawManifest.transformation_version) ||
      !Array.isArray(rawManifest.resources) || rawManifest.resources.length !== 2) {
    throw new Error("Invalid Tensift dam source manifest");
  }
  const sourceIds = new Set<string>();
  const sourceSheets = new Map<string, string>();
  for (const source of rawManifest.resources) {
    if (!isRecord(source) || !nonEmpty(source.id) || !slugPattern.test(source.id) ||
        sourceIds.has(source.id) || !isSourceUrl(source.resource_url) ||
        (source.period !== "2026-08" && source.period !== "2026-09") ||
        source.id !== `abht-tensift-${source.period}` ||
        source.sheet !== (source.period === "2026-08" ? "Août_2026" : "Sept_2026") ||
        !isSourceDate(source.source_updated_at)) {
      throw new Error("Invalid or duplicate Tensift dam source");
    }
    sourceIds.add(source.id);
    sourceSheets.set(source.id, source.sheet as string);
  }

  if (!Array.isArray(rawDams) || rawDams.length !== 5 ||
      !Array.isArray(rawLevels) || rawLevels.length !== 305) {
    throw new Error("Tensift snapshot must contain 5 dams and 305 daily observations");
  }
  const damIds = new Set<string>();
  for (const dam of rawDams) {
    if (!isRecord(dam) || !nonEmpty(dam.id) || !slugPattern.test(dam.id) || damIds.has(dam.id) ||
        dam.basin !== "tensift" || !isRecord(dam.name) || !nonEmpty(dam.name.fr)) {
      throw new Error("Invalid or duplicate Tensift dam");
    }
    damIds.add(dam.id);
  }

  const observations = new Set<string>();
  const damDates = new Map<string, Set<string>>();
  for (const level of rawLevels) {
    if (!isRecord(level) || typeof level.dam_id !== "string" || !damIds.has(level.dam_id) ||
        !isObservationDate(level.date) || level.date < "2026-08-01" || level.date > "2026-09-30" ||
        level.date > rawManifest.retrieved_at ||
        !isNonNegative(level.capacity_mm3) || level.capacity_mm3 === 0 ||
        !isNonNegative(level.volume_mm3) || !isNonNegative(level.filling_rate_pct) ||
        typeof level.source_id !== "string" || !sourceIds.has(level.source_id) ||
        level.source_id !== `abht-tensift-${level.date.slice(0, 7)}` ||
        !isRecord(level.source_ref) || level.source_ref.sheet !== sourceSheets.get(level.source_id) ||
        level.source_ref.row !== Number(level.date.slice(8, 10)) + 3) {
      throw new Error("Invalid Tensift daily observation or source reference");
    }
    const key = `${level.dam_id}:${level.date}`;
    if (observations.has(key)) throw new Error("Duplicate dam/date observation");
    observations.add(key);
    const dates = damDates.get(level.dam_id) ?? new Set<string>();
    dates.add(level.date);
    damDates.set(level.dam_id, dates);
    if (Math.abs(level.volume_mm3 / level.capacity_mm3 * 100 - level.filling_rate_pct) > 1e-8) {
      throw new Error("Inconsistent Tensift volume, capacity and filling percentage");
    }
  }
  if ([...damIds].some((id) => damDates.get(id)?.size !== 61)) {
    throw new Error("Every Tensift dam must have all 61 published daily observations");
  }

  return freezeTree({
    dams: structuredClone(rawDams) as Dam[],
    levels: structuredClone(rawLevels) as DamLevel[],
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
