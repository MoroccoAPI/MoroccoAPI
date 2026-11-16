import type { GeographySnapshot } from "../../../geography/types.js";
import {
  LABOUR_AREAS, LABOUR_FIELDS,
  type LabourArea, type LabourField, type LabourObservation,
} from "../types.js";

/** One row of a committed labour source file: every cell of the HCP sheet, empty cells as null. */
export type LabourRow = readonly (string | number | null)[];

/** The three committed source sheets, by published field. */
export type LabourRows = Record<LabourField, readonly LabourRow[]>;

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export interface LabourMappings {
  sheets: Section<{
    field: LabourField; dataset: string; file: string; source_sheet: string; title: string;
    header_rows: number; rows: number; columns: number;
  }>;
  layout: { description: string; label_columns: readonly [string, string]; unit: string; not_published_symbol: string };
  areas: Section<{ source_label: string; area: LabourArea }>;
  provinces: Section<{ source_name: string; code: string }>;
  unpublished_provinces: Section<{ code: string }>;
}

export interface LabourSnapshot {
  years: number[];
  observations: LabourObservation[];
}

/**
 * Wherever the three rates are published, employment must equal activity × (1 − unemployment)
 * to within this many percentage points. The source rounds each rate to one decimal; the largest
 * gap in the 2026-10-30 files is 0.113.
 */
export const RATE_IDENTITY_TOLERANCE = 0.15;

const SLUG = /^[a-z0-9]+(?:-+[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function entriesOf(value: Record<string, unknown>, section: string): Record<string, unknown>[] {
  const entries = isRecord(value[section]) ? value[section].entries : undefined;
  if (!isText((value[section] as Record<string, unknown> | undefined)?.description) ||
    !Array.isArray(entries) || !entries.length || !entries.every(isRecord)) {
    throw new Error(`Invalid labour mapping section '${section}'`);
  }
  return entries;
}

export function assertLabourMappings(value: unknown): asserts value is LabourMappings {
  const sections = ["areas", "layout", "provinces", "sheets", "unpublished_provinces"];
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== sections.join("|")) {
    throw new Error("Invalid labour mapping file");
  }
  entriesOf(value, "sheets").forEach((entry, index) => {
    if (!LABOUR_FIELDS.includes(entry.field as LabourField) || !isText(entry.dataset) || !isText(entry.file) ||
      !isText(entry.source_sheet) || !isText(entry.title) ||
      ![entry.header_rows, entry.rows, entry.columns].every(isCount)) {
      throw new Error(`Invalid labour sheet mapping at index ${index}`);
    }
  });
  const layout = value.layout;
  if (!isRecord(layout) || !isText(layout.description) || !Array.isArray(layout.label_columns) ||
    layout.label_columns.length !== 2 || !layout.label_columns.every(isText) ||
    !isText(layout.unit) || !isText(layout.not_published_symbol)) {
    throw new Error("Invalid labour mapping section 'layout'");
  }
  entriesOf(value, "areas").forEach((entry, index) => {
    if (!isText(entry.source_label) || !LABOUR_AREAS.includes(entry.area as LabourArea)) {
      throw new Error(`Invalid labour area mapping at index ${index}`);
    }
  });
  entriesOf(value, "provinces").forEach((entry, index) => {
    if (!isText(entry.source_name) || typeof entry.code !== "string" || !SLUG.test(entry.code)) {
      throw new Error(`Invalid labour province mapping at index ${index}`);
    }
  });
  entriesOf(value, "unpublished_provinces").forEach((entry, index) => {
    if (typeof entry.code !== "string" || !SLUG.test(entry.code)) {
      throw new Error(`Invalid unpublished labour province at index ${index}`);
    }
  });
}

/** Reads the four-digit year labels of a header row; they must be consecutive, newest first. */
function parseYears(labels: readonly unknown[], field: LabourField): number[] {
  const years = labels.map((label, index) => {
    if (typeof label !== "string" || !/^\d{4}$/.test(label)) {
      throw new Error(`Unexpected ${field} year header '${String(label)}' in column ${index + 2}`);
    }
    return Number(label);
  });
  if (!years.length || years.some((year, index) => index > 0 && year !== years[index - 1]! - 1)) {
    throw new Error(`The ${field} year columns must be consecutive years, newest first`);
  }
  return years;
}

/**
 * Builds the published labour observations from the verbatim HCP sheets and the mapping file.
 * The sheet titles, label columns and year headers are checked, every area and province label must be
 * mapped, every value must be a percentage or the not-published symbol, the three rates must agree with
 * each other, and every province of the administrative geography must be either published or listed as
 * unpublished, so a changed source or a stale mapping stops the build instead of being hidden.
 */
export function buildLabourSnapshot(
  rows: LabourRows,
  mappings: LabourMappings,
  geography: Pick<GeographySnapshot, "provinces">,
): LabourSnapshot {
  const { label_columns: labelColumns, not_published_symbol: notPublished } = mappings.layout;
  const sheets = new Map(mappings.sheets.entries.map((entry) => [entry.field, entry]));
  if (sheets.size !== LABOUR_FIELDS.length || mappings.sheets.entries.length !== LABOUR_FIELDS.length) {
    throw new Error("The mapping file must describe each labour sheet once");
  }
  const areas = new Map(mappings.areas.entries.map((entry) => [entry.source_label, entry.area]));
  if (areas.size !== LABOUR_AREAS.length || new Set(areas.values()).size !== LABOUR_AREAS.length) {
    throw new Error("The mapping file must map each labour area once");
  }
  const provincesByCode = new Map(geography.provinces.map((province) => [province.code, province]));
  const sourceNames = new Map<string, string>();
  for (const { source_name: name, code } of mappings.provinces.entries) {
    if (sourceNames.has(name) || [...sourceNames.values()].includes(code)) {
      throw new Error(`Labour province '${name}' (${code}) is mapped twice`);
    }
    if (!provincesByCode.has(code)) throw new Error(`Labour province '${name}' maps to unknown code '${code}'`);
    sourceNames.set(name, code);
  }
  const unpublished = new Set(mappings.unpublished_provinces.entries.map((entry) => entry.code));
  for (const code of unpublished) {
    if (!provincesByCode.has(code) || [...sourceNames.values()].includes(code)) {
      throw new Error(`Unpublished labour province '${code}' must be a geography code without a source row`);
    }
  }
  const uncovered = geography.provinces.filter((province) =>
    !unpublished.has(province.code) && ![...sourceNames.values()].includes(province.code));
  if (uncovered.length) {
    throw new Error(`No labour mapping for provinces: ${uncovered.map((province) => province.code).join(", ")}`);
  }

  // values[field] maps "code|area" to the rates of the sheet, aligned with the sheet's years.
  let years: number[] | undefined;
  const values = {} as Record<LabourField, Map<string, (number | null)[]>>;
  const usedNames = new Set<string>();
  for (const field of LABOUR_FIELDS) {
    const sheet = sheets.get(field)!;
    const sheetRows = rows[field];
    if (sheetRows.length !== sheet.rows) throw new Error(`The ${field} sheet must have ${sheet.rows} rows`);
    if (sheetRows.some((row) => !Array.isArray(row) || row.length !== sheet.columns)) {
      throw new Error(`Every ${field} row must have ${sheet.columns} cells`);
    }
    const [title, header] = sheetRows;
    if (title![0] !== sheet.title || title!.slice(1).some((cell) => cell !== null)) {
      throw new Error(`Unexpected ${field} sheet title row`);
    }
    if (header![0] !== labelColumns[0] || header![1] !== labelColumns[1]) {
      throw new Error(`Unexpected ${field} label columns`);
    }
    const sheetYears = parseYears(header!.slice(2), field);
    if (years && sheetYears.join() !== years.join()) throw new Error(`The ${field} sheet must cover the same years`);
    years ??= sheetYears;

    const byKey = new Map<string, (number | null)[]>();
    sheetRows.slice(sheet.header_rows).forEach((row, offset) => {
      const where = `in ${field} row ${sheet.header_rows + offset}`;
      const area = areas.get(String(row[0]));
      if (!area) throw new Error(`Unmapped labour area '${String(row[0])}' ${where}`);
      const code = sourceNames.get(String(row[1]));
      if (!code) throw new Error(`Unmapped labour province '${String(row[1])}' ${where}`);
      usedNames.add(String(row[1]));
      const key = `${code}|${area}`;
      if (byKey.has(key)) throw new Error(`Duplicate labour row for ${key} ${where}`);
      byKey.set(key, row.slice(2).map((cell, column) => {
        if (cell === notPublished) return null;
        if (typeof cell !== "number" || !Number.isFinite(cell) || cell < 0 || cell > 100) {
          throw new Error(`Invalid ${field} value '${String(cell)}' ${where}, column ${column + 2}`);
        }
        return cell;
      }));
    });
    values[field] = byKey;
  }
  const unused = [...sourceNames.keys()].filter((name) => !usedNames.has(name));
  if (unused.length) throw new Error(`Unused labour province mappings: ${unused.join(", ")}`);

  // The activity sheet is the reference: every province has an all-areas row, and the other sheets add no row.
  const activity = values.activity_rate;
  for (const code of sourceNames.values()) {
    if (!activity.has(`${code}|all`)) throw new Error(`Labour province '${code}' has no all-areas activity row`);
  }
  for (const field of ["employment_rate", "unemployment_rate"] as const) {
    const extra = [...values[field].keys()].filter((key) => !activity.has(key));
    if (extra.length) throw new Error(`The ${field} sheet has rows missing from the activity sheet: ${extra.join(", ")}`);
  }

  const observations: LabourObservation[] = [];
  const oldestFirst = years!.map((year, column) => [year, column] as const).reverse();
  const published = [...sourceNames.values()].sort();
  for (const code of published) {
    const province = provincesByCode.get(code)!;
    for (const area of LABOUR_AREAS) {
      const key = `${code}|${area}`;
      for (const [year, column] of oldestFirst) {
        const rate = (field: LabourField) => values[field].get(key)?.[column] ?? null;
        const act = rate("activity_rate");
        const emp = rate("employment_rate");
        const unemp = rate("unemployment_rate");
        if (act === null && emp === null && unemp === null) continue;
        const where = `for ${key} in ${year}`;
        if (act !== null && emp !== null && emp > act) throw new Error(`Employment rate exceeds activity rate ${where}`);
        if (act !== null && emp !== null && unemp !== null &&
          Math.abs(emp - act * (1 - unemp / 100)) > RATE_IDENTITY_TOLERANCE) {
          throw new Error(`Employment rate differs from activity × (1 − unemployment) ${where}`);
        }
        observations.push({
          code, hcp_code: province.hcp_code, name: { ...province.name }, region_code: province.region_code,
          area, year, activity_rate: act, employment_rate: emp, unemployment_rate: unemp,
        });
      }
    }
  }
  return { years: oldestFirst.map(([year]) => year), observations };
}
