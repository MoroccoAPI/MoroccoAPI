import type { GeographySnapshot, SourceLanguageName } from "../../../geography/types.js";
import { hcpCodeCandidates, ROW_KINDS } from "../../indicators/data/transform.js";
import type { IndicatorLevel } from "../../indicators/types.js";
import {
  DEPRIVATIONS, HEADLINE_FIELDS, MPI_TRENDS, POVERTY_AREAS, POVERTY_YEARS,
  type Deprivation, type MpiTrend, type PovertyArea, type PovertyField,
  type PovertyObservation, type PovertyTerritory, type PovertyYear,
} from "../types.js";

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export type PovertyColumn = { area: PovertyArea; column: number; source_label: string } & (
  | { role: "name" | "code" | "source_level" | "year" | "mpi_trend" | "not_published" }
  | { role: "value"; field: PovertyField }
);

export interface PovertyMappings {
  sheets: Section<{
    area: PovertyArea; source_sheet: string; file: string; title: string; unit_of_measure: string;
    header_rows: number; footer_rows: number; columns: number;
  }>;
  columns: Section<PovertyColumn>;
  mpi_trend_symbols: Section<{ symbol: string; value: MpiTrend }>;
  aligned_with_dakhla_2014: Section<{ source_code: string }>;
}

/** Raw rows of the three HCP area sheets, as committed under data/population/source/. */
export type PovertyRows = Record<PovertyArea, readonly (readonly unknown[])[]>;

export interface PovertySnapshot {
  territories: PovertyTerritory[];
  observations: PovertyObservation[][];
  excluded: { cercles: number; urban_centres: number };
}

const NATIONAL_NAME = "Ensemble du territoire national";
const FIELDS: readonly PovertyField[] = [...HEADLINE_FIELDS, ...DEPRIVATIONS];
const ROLES = ["name", "code", "source_level", "year", "value", "mpi_trend", "not_published"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const clean = (value: unknown) => (value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim());

export function assertPovertyMappings(value: unknown): asserts value is PovertyMappings {
  const sections = ["aligned_with_dakhla_2014", "columns", "mpi_trend_symbols", "sheets"];
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== sections.join("|") ||
    sections.some((section) => {
      const entries = (value[section] as Record<string, unknown> | undefined)?.entries;
      return !isRecord(value[section]) || !Array.isArray(entries) || !entries.every(isRecord);
    })) {
    throw new Error("Invalid poverty mapping file");
  }
  const entries = (section: string) => (value[section] as { entries: Record<string, unknown>[] }).entries;
  entries("sheets").forEach((entry, index) => {
    if (!POVERTY_AREAS.includes(entry.area as PovertyArea) || !isText(entry.source_sheet) || !isText(entry.file) ||
      !isText(entry.title) || !isText(entry.unit_of_measure) ||
      ![entry.header_rows, entry.footer_rows, entry.columns].every((count) => Number.isSafeInteger(count) && (count as number) > 0)) {
      throw new Error(`Invalid poverty sheet mapping at index ${index}`);
    }
  });
  entries("columns").forEach((entry, index) => {
    if (!POVERTY_AREAS.includes(entry.area as PovertyArea) || !Number.isSafeInteger(entry.column) ||
      typeof entry.source_label !== "string" || !ROLES.includes(entry.role as string) ||
      (entry.role === "value" ? !FIELDS.includes(entry.field as PovertyField) : "field" in entry)) {
      throw new Error(`Invalid poverty column mapping at index ${index}`);
    }
  });
  entries("mpi_trend_symbols").forEach((entry, index) => {
    if (!isText(entry.symbol) || !MPI_TRENDS.includes(entry.value as MpiTrend)) {
      throw new Error(`Invalid MPI trend symbol at index ${index}`);
    }
  });
  entries("aligned_with_dakhla_2014").forEach((entry, index) => {
    if (!isText(entry.source_code) || !/^\d+$/.test(entry.source_code)) {
      throw new Error(`Invalid Dakhla-aligned commune at index ${index}`);
    }
  });
}

/**
 * Header path of a column: group (row 2) and sub-group (row 3) carried over from the left within their group,
 * then the indicator (row 4) and unit (row 5) of the column itself.
 */
function headerLabel(rows: readonly (readonly unknown[])[], column: number): string {
  const parts: string[] = [];
  for (let row = 2; row <= 5; row++) {
    let cell = clean(rows[row]![column]);
    if (!cell && (row === 2 || row === 3)) {
      for (let left = column; left >= 0; left--) {
        const text = clean(rows[row]![left]);
        if (text) {
          cell = text;
          break;
        }
        if (left === 0 || (row === 3 && clean(rows[2]![left]))) break;
      }
    }
    if (cell) parts.push(cell);
  }
  return parts.join(" › ");
}

function parseValue(cell: unknown, field: PovertyField, where: string): number | null {
  if (cell === "") return null;
  const maximum = field === "mpi" ? 1 : 100;
  if (typeof cell !== "number" || !Number.isFinite(cell) || cell < 0 || cell > maximum) {
    throw new Error(`Invalid ${field} value ${where}`);
  }
  return cell;
}

/**
 * Builds the published poverty observations from the verbatim HCP sheets and the mapping file.
 * Every column header is checked, the three sheets must list the same territories, MPI must equal H × A,
 * and every territory of the administrative geography must appear exactly once, so a changed source
 * or a stale mapping stops the build instead of being hidden.
 */
export function buildPovertySnapshot(
  rows: PovertyRows,
  mappings: PovertyMappings,
  geography: GeographySnapshot,
): PovertySnapshot {
  const sheets = new Map(mappings.sheets.entries.map((entry) => [entry.area, entry]));
  if (sheets.size !== POVERTY_AREAS.length || mappings.sheets.entries.length !== POVERTY_AREAS.length) {
    throw new Error("The mapping file must describe each poverty sheet once");
  }
  const symbols = new Map(mappings.mpi_trend_symbols.entries.map((entry) => [entry.symbol, entry.value]));
  const aligned = new Set(mappings.aligned_with_dakhla_2014.entries.map((entry) => entry.source_code));

  // Sheets: title, unit of measure, exact headers and complete column coverage.
  const data = {} as Record<PovertyArea, readonly (readonly unknown[])[]>;
  const valueColumns = {} as Record<PovertyArea, Map<PovertyField, number>>;
  const trendColumn = {} as Record<PovertyArea, number>;
  for (const area of POVERTY_AREAS) {
    const sheet = sheets.get(area)!;
    const sheetRows = rows[area];
    if (sheetRows.some((row) => !Array.isArray(row) || row.length !== sheet.columns)) {
      throw new Error(`Every ${area} poverty row must have ${sheet.columns} cells`);
    }
    if (clean(sheetRows[0]?.[0]) !== sheet.title || clean(sheetRows[1]?.[0]) !== sheet.unit_of_measure) {
      throw new Error(`The ${area} poverty sheet must start with its title and unit of measure`);
    }
    const columns = mappings.columns.entries.filter((entry) => entry.area === area);
    if (columns.length !== sheet.columns || columns.some((entry, index) => entry.column !== index)) {
      throw new Error(`The mapping file must list the ${sheet.columns} ${area} poverty columns in order`);
    }
    valueColumns[area] = new Map();
    for (const entry of columns) {
      const label = headerLabel(sheetRows, entry.column);
      if (label !== entry.source_label) {
        throw new Error(`Header of ${area} poverty column ${entry.column} is '${label}', not '${entry.source_label}'`);
      }
      if (entry.role === "value") {
        if (valueColumns[area].has(entry.field)) throw new Error(`Field '${entry.field}' is mapped twice in ${area}`);
        valueColumns[area].set(entry.field, entry.column);
      }
      if (entry.role === "mpi_trend") trendColumn[area] = entry.column;
    }
    const roleAt = (index: number) => columns[index]!.role;
    if (roleAt(0) !== "name" || roleAt(1) !== "code" || roleAt(3) !== "year" ||
      valueColumns[area].size !== FIELDS.length || trendColumn[area] === undefined) {
      throw new Error(`The ${area} poverty mapping must cover name, code, year, ${FIELDS.length} fields and the MPI trend`);
    }
    const footer = sheetRows.slice(-sheet.footer_rows);
    if (footer.some((row) => !isText(row[0]) || row.slice(1).some((cell) => cell !== ""))) {
      throw new Error(`The ${area} poverty sheet must end with ${sheet.footer_rows} footnote rows`);
    }
    data[area] = sheetRows.slice(sheet.header_rows, sheetRows.length - sheet.footer_rows);
  }

  // The three sheets list the same territory-years; only the * marker may differ.
  const base = data.all;
  const key = (row: readonly unknown[]) => `${clean(row[0]).replace(/\*$/, "")}|${String(row[1])}|${String(row[3])}`;
  for (const area of POVERTY_AREAS) {
    if (data[area].length !== base.length || data[area].some((row, index) => key(row) !== key(base[index]!))) {
      throw new Error(`The ${area} poverty sheet must list the same territories as the all-areas sheet`);
    }
  }
  if (base.length % 2 !== 0) throw new Error("Poverty rows must come in 2024 and 2014 pairs");

  const lookups = {
    regions: new Map(geography.regions.map((record) => [record.hcp_code, record])),
    subdivisions: new Map(geography.provinces.map((record) => [record.hcp_code, record])),
    "prefectures-of-arrondissements": new Map(geography.prefecturesOfArrondissements.map((record) => [record.hcp_code, record])),
    communes: new Map(geography.communes.map((record) => [record.hcp_code, record])),
    arrondissements: new Map(geography.arrondissements.map((record) => [record.hcp_code, record])),
  };
  const linked = new Set<string>();
  const usedAligned = new Set<string>();
  const excluded = { cercles: 0, urban_centres: 0 };
  const territories: PovertyTerritory[] = [];
  const observations: PovertyObservation[][] = [];

  for (let index = 0; index < base.length; index += 2) {
    const [current, previous] = [base[index]!, base[index + 1]!];
    const code = current[1];
    if (current[3] !== 2024 || previous[3] !== 2014 || previous[1] !== code) {
      throw new Error(`Poverty rows ${index} and ${index + 1} must be the 2024 and 2014 rows of one territory`);
    }
    const name = clean(current[0]).replace(/\*$/, "");
    let territory: PovertyTerritory;
    if (index === 0) {
      if (code !== 0 || name !== NATIONAL_NAME) throw new Error(`The first poverty rows must be '${NATIONAL_NAME}'`);
      territory = {
        level: "national", code: null, hcp_code: null, name: { ar: "المغرب", fr: "Maroc", en: "Morocco" },
        region_code: null, province_code: null,
      };
    } else {
      // HCP's own level column labels Tanger or Rabat as prefectures of arrondissements, so rows are typed by name.
      const kind = ROW_KINDS.find(([pattern]) => pattern.test(name))?.[1];
      if (!kind) throw new Error(`Poverty row ${index} ('${name}') has an unknown territory type`);
      if (kind === "cercle" || kind === "urban_centre") {
        excluded[kind === "cercle" ? "cercles" : "urban_centres"]++;
        continue;
      }
      const lookup: Map<string, { code: string; hcp_code: string; name: SourceLanguageName; region_code?: string; province_code?: string }> = lookups[kind];
      const matches = hcpCodeCandidates(code).filter((candidate) => lookup.has(candidate));
      if (matches.length !== 1) throw new Error(`Poverty row ${index} ('${name}') does not match exactly one ${kind} record`);
      const record = lookup.get(matches[0]!)!;
      const linkKey = `${kind}|${record.hcp_code}`;
      if (linked.has(linkKey)) throw new Error(`Territory ${linkKey} appears twice in the poverty data`);
      linked.add(linkKey);
      territory = {
        level: kind as Exclude<IndicatorLevel, "national">, code: record.code, hcp_code: record.hcp_code,
        name: { ...record.name }, region_code: record.region_code ?? null, province_code: record.province_code ?? null,
      };
    }

    const sourceCode = String(code);
    const marked = POVERTY_AREAS.some((area) => [index, index + 1].some((row) => clean(data[area][row]![0]).endsWith("*")));
    if (marked && !aligned.has(sourceCode)) throw new Error(`Poverty row ${index} ('${name}') is marked * but is not listed`);
    if (aligned.has(sourceCode)) {
      if (!clean(previous[0]).endsWith("*")) throw new Error(`Listed Dakhla-aligned commune '${name}' is not marked * in 2014`);
      usedAligned.add(sourceCode);
    }

    const territoryObservations: PovertyObservation[] = [];
    for (const area of POVERTY_AREAS) {
      for (const [offset, year] of POVERTY_YEARS.entries()) {
        const row = data[area][index + offset]!;
        const where = `in ${area} row ${index + offset} ('${name}', ${year})`;
        const value = (field: PovertyField) => parseValue(row[valueColumns[area].get(field)!], field, where);
        const trendCell = row[trendColumn[area]];
        let mpiTrend: MpiTrend | null = null;
        if (trendCell !== "") {
          if (year === 2014 || !symbols.has(String(trendCell))) throw new Error(`Invalid MPI trend '${String(trendCell)}' ${where}`);
          mpiTrend = symbols.get(String(trendCell))!;
        }
        const values = Object.fromEntries(FIELDS.map((field) => [field, value(field)])) as Record<PovertyField, number | null>;
        if (FIELDS.every((field) => values[field] === null)) {
          if (mpiTrend !== null) throw new Error(`MPI trend without values ${where}`);
          continue;
        }
        const { mpi, poverty_rate: rate, poverty_intensity: intensity } = values;
        if (mpi !== null && rate !== null && intensity !== null && Math.abs(mpi - (rate * intensity) / 10000) > 1e-6) {
          throw new Error(`MPI differs from poverty rate × intensity ${where}`);
        }
        territoryObservations.push({
          area, year: year as PovertyYear,
          mpi, poverty_rate: rate, poverty_intensity: intensity, vulnerability_rate: values.vulnerability_rate,
          deprivation_rates: Object.fromEntries(DEPRIVATIONS.map((field) => [field, values[field]])) as Record<Deprivation, number | null>,
          mpi_trend: mpiTrend,
          aligned_with_dakhla: year === 2014 && aligned.has(sourceCode),
        });
      }
    }
    if (!territoryObservations.some((observation) => observation.area === "all")) {
      throw new Error(`Poverty row ${index} ('${name}') has no all-areas values`);
    }
    territories.push(territory);
    observations.push(territoryObservations);
  }

  for (const [kind, lookup] of Object.entries(lookups)) {
    const missing = [...lookup.keys()].filter((hcpCode) => !linked.has(`${kind}|${hcpCode}`));
    if (missing.length) throw new Error(`No poverty rows for ${kind}: ${missing.slice(0, 5).join(", ")}`);
  }
  const unused = [...aligned].filter((code) => !usedAligned.has(code));
  if (unused.length) throw new Error(`Unused Dakhla-aligned communes: ${unused.join(", ")}`);
  return { territories, observations, excluded };
}
