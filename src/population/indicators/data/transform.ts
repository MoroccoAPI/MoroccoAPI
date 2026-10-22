import type { GeographySnapshot, SourceLanguageName } from "../../../geography/types.js";
import type {
  CommunePopulation, NationalPopulation, RegionPopulation, SubdivisionPopulation,
} from "../../types.js";
import {
  INDICATOR_UNITS, SEXES,
  type IndicatorDefinition, type IndicatorGroup, type IndicatorLevel, type IndicatorUnit,
  type LocalizedName, type NullReason, type Sex, type SexValues, type Territory,
} from "../types.js";

type SheetId = "population" | "households";

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export type ColumnMapping =
  | { sheet: SheetId; column: number; role: "code" | "name" | "separator"; source_label: string }
  | {
    sheet: SheetId; column: number; role: "value" | "duplicate" | "cross_sheet_duplicate";
    sex: Sex; indicator: string; source_label: string;
  };

export interface IndicatorMappings {
  sheets: Section<{ sheet: SheetId; source_sheet: string; area_label: string; header_rows: number }>;
  groups: Section<{ id: string; name: LocalizedName }>;
  indicators: Section<{ id: string; group: string; unit: IndicatorUnit; name: LocalizedName }>;
  columns: Section<ColumnMapping>;
  local_administration_communes: Section<{ source_code: string }>;
}

/** Raw rows of the two HCP sheets, as committed under data/population/source/. */
export type SourceRows = Record<SheetId, readonly (readonly unknown[])[]>;

/** Records already served by the population API, used to cross-check the census counts. */
export interface ExistingPopulation {
  national: NationalPopulation;
  regions: readonly RegionPopulation[];
  subdivisions: readonly SubdivisionPopulation[];
  communes: readonly CommunePopulation[];
}

export interface IndicatorSnapshot {
  groups: IndicatorGroup[];
  indicators: IndicatorDefinition[];
  territories: Territory[];
  values: SexValues[][];
  excluded: { cercles: number; urban_centres: number };
}

const SHEETS: readonly SheetId[] = ["population", "households"];
const NATIONAL_NAME = "Ensemble du territoire national";
const SEX_HEADERS: Record<string, Sex> = {
  "Sexe : Ensemble": "both_sexes", "Sexe : Masculin": "male", "Sexe : Féminin": "female",
};
// Rows are typed by the start of their HCP name; cercles and "dont le centre urbain" rows are not published.
const ROW_KINDS: readonly [RegExp, Exclude<IndicatorLevel, "national"> | "cercle" | "urban_centre"][] = [
  [/^Région (?:de |d')/, "regions"],
  // HCP writes both "Préfecture d'arrondissements" and "Préfecture d'arrondissement".
  [/^Préfecture d'arrondissements? (?:de |d')/, "prefectures-of-arrondissements"],
  [/^(?:Province|Préfecture) (?:de |d')/, "subdivisions"],
  [/^Commune (?:de |d')/, "communes"],
  [/^Arrondissement (?:de |d')/, "arrondissements"],
  [/^Cercle (?:de |d')/, "cercle"],
  [/^dont /, "urban_centre"],
];
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isName = (value: unknown): value is LocalizedName =>
  isRecord(value) && isText(value.fr) && isText(value.en) && isText(value.ar);

export function assertIndicatorMappings(value: unknown): asserts value is IndicatorMappings {
  const sections = ["columns", "groups", "indicators", "local_administration_communes", "sheets"];
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== sections.join("|") ||
    sections.some((section) => {
      const entries = (value[section] as Record<string, unknown> | undefined)?.entries;
      return !isRecord(value[section]) || !Array.isArray(entries) || !entries.every(isRecord);
    })) {
    throw new Error("Invalid population indicator mapping file");
  }
  const entries = (section: string) => (value[section] as { entries: Record<string, unknown>[] }).entries;
  entries("sheets").forEach((entry, index) => {
    if (!SHEETS.includes(entry.sheet as SheetId) || !isText(entry.source_sheet) || !isText(entry.area_label) ||
      !Number.isSafeInteger(entry.header_rows) || (entry.header_rows as number) < 2) {
      throw new Error(`Invalid population indicator sheet mapping at index ${index}`);
    }
  });
  entries("groups").forEach((entry, index) => {
    if (!isText(entry.id) || !ID_PATTERN.test(entry.id) || !isName(entry.name)) {
      throw new Error(`Invalid population indicator group at index ${index}`);
    }
  });
  entries("indicators").forEach((entry, index) => {
    if (!isText(entry.id) || !ID_PATTERN.test(entry.id) || entry.id.length > 64 || !isText(entry.group) ||
      !INDICATOR_UNITS.includes(entry.unit as IndicatorUnit) || !isName(entry.name)) {
      throw new Error(`Invalid population indicator at index ${index}`);
    }
  });
  entries("columns").forEach((entry, index) => {
    const valueRole = entry.role === "value" || entry.role === "duplicate" || entry.role === "cross_sheet_duplicate";
    if (!SHEETS.includes(entry.sheet as SheetId) || !Number.isSafeInteger(entry.column) ||
      typeof entry.source_label !== "string" ||
      !(valueRole || entry.role === "code" || entry.role === "name" || entry.role === "separator") ||
      (valueRole ? !SEXES.includes(entry.sex as Sex) || !isText(entry.indicator) : "sex" in entry || "indicator" in entry)) {
      throw new Error(`Invalid population indicator column mapping at index ${index}`);
    }
  });
  entries("local_administration_communes").forEach((entry, index) => {
    if (!isText(entry.source_code) || !/^\d+$/.test(entry.source_code)) {
      throw new Error(`Invalid local administration commune at index ${index}`);
    }
  });
}

/** Turns a compact HCP code (e.g. 1511010) into the dotted geography codes it can denote (01.511.01.0). */
export function hcpCodeCandidates(code: unknown): string[] {
  const text = typeof code === "number" && Number.isSafeInteger(code) ? String(code) : "";
  if (!/^\d+$/.test(text)) return [];
  if (text.length <= 2) return [text.padStart(2, "0")];
  const candidates: string[] = [];
  // Tails: commune or arrondissement (3,2,2), commune of a large city (3,2,1), cercle (3,2), province (3).
  for (const [tail, sizes] of [[7, [3, 2, 2]], [6, [3, 2, 1]], [5, [3, 2]], [3, [3]]] as const) {
    const head = text.length - tail;
    if (head !== 1 && head !== 2) continue;
    const parts = [text.slice(0, head).padStart(2, "0")];
    let index = head;
    for (const size of sizes) {
      parts.push(text.slice(index, index + size));
      index += size;
    }
    candidates.push(parts.join("."));
  }
  return candidates;
}

const clean = (value: unknown) => (value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim());

/** Header label of every column: "group › sub-indicator" (group forward-filled), with its sex block. */
function headerLabels(rows: readonly (readonly unknown[])[], headerRows: number, withSex: boolean, width: number) {
  let sex: Sex | null = null;
  let group = "";
  const labels: { label: string; sex: Sex | null; last: string }[] = [];
  for (let column = 0; column < width; column++) {
    const cells = rows.slice(0, headerRows).map((row) => clean(row[column]));
    if (withSex && cells[0]!.startsWith("Sexe")) {
      sex = SEX_HEADERS[cells[0]!] ?? null;
      if (!sex) throw new Error(`Unknown sex header '${cells[0]}' in column ${column}`);
    }
    const [groupCell, sub] = withSex ? [cells[1]!, cells[2]!] : [cells[0]!, cells[1]!];
    if (groupCell) group = groupCell;
    const label = column >= 2 && (groupCell || sub) ? [group, sub].filter(Boolean).join(" › ") : "";
    labels.push({ label, sex: withSex ? sex : "both_sexes", last: cells[headerRows - 1]! });
  }
  return labels;
}

function parseCell(cell: unknown, unit: IndicatorUnit, where: string): { value: number | null; reason: NullReason | null } {
  if (typeof cell === "number" && Number.isFinite(cell) && cell >= 0) {
    if ((unit === "persons" || unit === "households") && !Number.isSafeInteger(cell)) {
      throw new Error(`Count ${where} is not an integer`);
    }
    if (unit === "percent" && cell > 100) throw new Error(`Percentage ${where} exceeds 100`);
    return { value: cell, reason: null };
  }
  if (cell === ".") return { value: null, reason: "unavailable" };
  if (cell === "…") return { value: null, reason: "not_applicable" };
  throw new Error(`Invalid value ${where}`);
}

/**
 * Builds the published indicators from the verbatim HCP rows and the mapping file.
 * Every column must be mapped to its exact header, repeated columns must equal the column they repeat,
 * and every territory of the administrative geography must appear exactly once, so a changed source
 * or a stale mapping stops the build instead of being hidden.
 */
export function buildIndicatorSnapshot(
  rows: SourceRows,
  mappings: IndicatorMappings,
  geography: GeographySnapshot,
  existing: ExistingPopulation,
): IndicatorSnapshot {
  const sheets = new Map(mappings.sheets.entries.map((entry) => [entry.sheet, entry]));
  if (sheets.size !== SHEETS.length || mappings.sheets.entries.length !== SHEETS.length) {
    throw new Error("The mapping file must describe each indicator sheet once");
  }

  // Columns: exact headers, complete coverage, one value column per indicator and sex.
  const valueColumns = new Map<string, { sheet: SheetId; column: number; label: string }>();
  const repeats: { sheet: SheetId; column: number; key: string; crossSheet: boolean }[] = [];
  const dataRows = {} as Record<SheetId, readonly (readonly unknown[])[]>;
  for (const sheet of SHEETS) {
    const { header_rows: headerRows, area_label: areaLabel } = sheets.get(sheet)!;
    const sheetRows = rows[sheet];
    const width = sheetRows[0]?.length ?? 0;
    if (clean(sheetRows[0]?.[0]) !== areaLabel) throw new Error(`The ${sheet} sheet must start with '${areaLabel}'`);
    if (sheetRows.some((row) => !Array.isArray(row) || row.length !== width)) {
      throw new Error(`Every ${sheet} row must have ${width} cells`);
    }
    dataRows[sheet] = sheetRows.slice(headerRows);
    const labels = headerLabels(sheetRows, headerRows, sheet === "population", width);
    const columns = mappings.columns.entries.filter((entry) => entry.sheet === sheet);
    if (columns.length !== width || columns.some((entry, index) => entry.column !== index)) {
      throw new Error(`The mapping file must list the ${width} ${sheet} columns in order`);
    }
    for (const entry of columns) {
      const header = labels[entry.column]!;
      const where = `${sheet} column ${entry.column}`;
      if (entry.role === "code" || entry.role === "name") {
        if (entry.column !== (entry.role === "code" ? 0 : 1) || header.last !== entry.source_label) {
          throw new Error(`Unexpected ${entry.role} header in ${where}`);
        }
        continue;
      }
      if (header.label !== entry.source_label) {
        throw new Error(`Header of ${where} is '${header.label}', not '${entry.source_label}'`);
      }
      if (!("indicator" in entry)) {
        if (dataRows[sheet].some((row) => row[entry.column] !== null)) throw new Error(`Separator ${where} is not empty`);
        continue;
      }
      if (header.sex !== entry.sex) throw new Error(`Sex of ${where} is '${header.sex}', not '${entry.sex}'`);
      const key = `${entry.indicator}|${entry.sex}`;
      if (entry.role !== "value") {
        repeats.push({ sheet, column: entry.column, key, crossSheet: entry.role === "cross_sheet_duplicate" });
        continue;
      }
      if (valueColumns.has(key)) throw new Error(`Indicator '${entry.indicator}' has two ${entry.sex} columns`);
      valueColumns.set(key, { sheet, column: entry.column, label: entry.source_label });
    }
  }

  const population = dataRows.population;
  const households = dataRows.households;
  if (population.length !== households.length ||
    population.some((row, index) => row[0] !== households[index]![0] || row[1] !== households[index]![1])) {
    throw new Error("The population and households sheets must list the same territories in the same order");
  }
  for (const repeat of repeats) {
    const target = valueColumns.get(repeat.key);
    if (!target || (target.sheet !== repeat.sheet) === !repeat.crossSheet) {
      throw new Error(`Repeated ${repeat.sheet} column ${repeat.column} does not match a value column`);
    }
    const differs = population.findIndex((_, index) =>
      dataRows[repeat.sheet][index]![repeat.column] !== dataRows[target.sheet][index]![target.column]);
    if (differs >= 0) throw new Error(`Repeated ${repeat.sheet} column ${repeat.column} differs in row ${differs}`);
  }

  // Groups and indicators.
  const groups = mappings.groups.entries.map((entry) => ({ id: entry.id, name: { ...entry.name } }));
  const groupIds = new Set(groups.map((group) => group.id));
  if (groupIds.size !== groups.length) throw new Error("Duplicate population indicator group");
  const indicatorIds = new Set<string>();
  const usedGroups = new Set<string>();
  const indicators: IndicatorDefinition[] = mappings.indicators.entries.map((entry) => {
    if (indicatorIds.has(entry.id)) throw new Error(`Duplicate population indicator '${entry.id}'`);
    indicatorIds.add(entry.id);
    if (!groupIds.has(entry.group)) throw new Error(`Unknown group '${entry.group}' for '${entry.id}'`);
    usedGroups.add(entry.group);
    const sexes = SEXES.filter((sex) => valueColumns.has(`${entry.id}|${sex}`));
    const both = valueColumns.get(`${entry.id}|both_sexes`);
    if (!both) throw new Error(`Indicator '${entry.id}' has no both-sexes column`);
    for (const sex of sexes) {
      const column = valueColumns.get(`${entry.id}|${sex}`)!;
      if (column.sheet !== both.sheet || column.label !== both.label) {
        throw new Error(`The ${sex} column of '${entry.id}' has a different header`);
      }
    }
    return { id: entry.id, group: entry.group, unit: entry.unit, name: { ...entry.name }, source_label: both.label, sexes };
  });
  const unknown = [...valueColumns.keys()].map((key) => key.split("|")[0]!).filter((id) => !indicatorIds.has(id));
  if (unknown.length) throw new Error(`Columns mapped to unknown indicators: ${[...new Set(unknown)].join(", ")}`);
  const unusedGroups = groups.filter((group) => !usedGroups.has(group.id)).map((group) => group.id);
  if (unusedGroups.length) throw new Error(`Unused population indicator groups: ${unusedGroups.join(", ")}`);

  // Territories: national row, then each HCP row linked to exactly one geography record.
  const byHcpCode = <T extends { hcp_code: string }>(records: readonly T[]) =>
    new Map(records.map((record) => [record.hcp_code, record]));
  const lookups = {
    regions: byHcpCode(geography.regions),
    subdivisions: byHcpCode(geography.provinces),
    "prefectures-of-arrondissements": byHcpCode(geography.prefecturesOfArrondissements),
    communes: byHcpCode(geography.communes),
    arrondissements: byHcpCode(geography.arrondissements),
  };
  const localAdministration = new Set(mappings.local_administration_communes.entries.map((entry) => entry.source_code));
  const flagged = new Set<string>();
  const linked = new Set<string>();
  const excluded = { cercles: 0, urban_centres: 0 };
  const territories: Territory[] = [];
  const values: SexValues[][] = [];

  for (const [index, row] of population.entries()) {
    const [code, rawName] = row;
    if (!isText(rawName)) throw new Error(`Row ${index} has no territory name`);
    const name = rawName.trim();
    let territory: Territory;
    if (index === 0) {
      if (code !== null || name !== NATIONAL_NAME) throw new Error(`The first row must be '${NATIONAL_NAME}'`);
      territory = {
        level: "national", code: null, hcp_code: null, name: { ar: "المغرب", fr: "Maroc", en: "Morocco" },
        region_code: null, province_code: null, data_from_local_administration: false,
      };
    } else {
      const kind = ROW_KINDS.find(([pattern]) => pattern.test(name))?.[1];
      if (!kind) throw new Error(`Row ${index} ('${name}') has an unknown territory type`);
      if (kind === "cercle" || kind === "urban_centre") {
        excluded[kind === "cercle" ? "cercles" : "urban_centres"]++;
        continue;
      }
      const lookup: Map<string, { code: string; hcp_code: string; name: SourceLanguageName; region_code?: string; province_code?: string }> = lookups[kind];
      const matches = hcpCodeCandidates(code).filter((candidate) => lookup.has(candidate));
      if (matches.length !== 1) throw new Error(`Row ${index} ('${name}') does not match exactly one ${kind} record`);
      const record = lookup.get(matches[0]!)!;
      const key = `${kind}|${record.hcp_code}`;
      if (linked.has(key)) throw new Error(`Territory ${key} appears twice`);
      linked.add(key);
      const marked = name.endsWith("*");
      if (marked) {
        if (kind !== "communes" || !localAdministration.has(String(code))) {
          throw new Error(`Row ${index} ('${name}') is marked * but is not a listed local administration commune`);
        }
        flagged.add(String(code));
      }
      territory = {
        level: kind, code: record.code, hcp_code: record.hcp_code, name: { ...record.name },
        region_code: record.region_code ?? null, province_code: record.province_code ?? null,
        data_from_local_administration: marked,
      };
    }
    territories.push(territory);
    values.push(indicators.map((indicator) => {
      const result: SexValues = {
        both_sexes: null, male: null, female: null,
        null_reasons: { both_sexes: "not_published", male: "not_published", female: "not_published" },
      };
      for (const sex of indicator.sexes) {
        const { sheet, column } = valueColumns.get(`${indicator.id}|${sex}`)!;
        const cell = parseCell(dataRows[sheet][index]![column], indicator.unit, `for '${indicator.id}' (${sex}) in row ${index}`);
        result[sex] = cell.value;
        result.null_reasons[sex] = cell.reason;
      }
      return result;
    }));
  }

  for (const [kind, lookup] of Object.entries(lookups)) {
    const missing = [...lookup.keys()].filter((hcpCode) => !linked.has(`${kind}|${hcpCode}`));
    if (missing.length) throw new Error(`No indicator row for ${kind}: ${missing.slice(0, 5).join(", ")}`);
  }
  const unflagged = [...localAdministration].filter((code) => !flagged.has(code));
  if (unflagged.length) throw new Error(`Local administration communes not marked *: ${unflagged.join(", ")}`);

  assertMatchesExistingPopulation(territories, values, indicators, existing);
  return { groups, indicators, territories, values, excluded };
}

/** The census counts must equal the legal population and households already served by the population API. */
function assertMatchesExistingPopulation(
  territories: readonly Territory[],
  values: readonly (readonly SexValues[])[],
  indicators: readonly IndicatorDefinition[],
  existing: ExistingPopulation,
) {
  const position = (id: string) => indicators.findIndex((indicator) => indicator.id === id);
  const legal = position("legal-population");
  const householdCount = position("households");
  if (legal < 0 || householdCount < 0) throw new Error("The legal population and households indicators are required");
  const expected = new Map<string, { population: number; households: number | null }>([
    ["national|", { population: existing.national.total, households: null }],
    ...existing.regions.map((record) => [`regions|${record.code}`, { population: record.population, households: null }] as const),
    ...existing.subdivisions.map((record) => [`subdivisions|${record.code}`, record] as const),
    ...existing.communes.map((record) => [`communes|${record.code}`, record] as const),
  ]);
  for (const [index, territory] of territories.entries()) {
    const reference = expected.get(`${territory.level}|${territory.code ?? ""}`);
    if (!reference) continue;
    const row = values[index]!;
    if (row[legal]!.both_sexes !== reference.population ||
      (reference.households !== null && row[householdCount]!.both_sexes !== reference.households)) {
      throw new Error(`Census counts for ${territory.level} '${territory.code ?? "national"}' differ from the population dataset`);
    }
  }
}
