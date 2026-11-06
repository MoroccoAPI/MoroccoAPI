import type { CpiCity, CpiData, CpiProduct, CpiSeries, ProductLevel } from "../types.js";
import { PRODUCT_LEVELS } from "../types.js";

/** One row of data/prices/source/cpi-monthly.json: every cell of the source sheet, empty cells as null. */
export type CpiRow = readonly (string | number | null)[];

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export interface CpiMappings {
  sheet: {
    description: string;
    name: string;
    title: string;
    label_columns: readonly [string, string];
    header_rows: number;
    rows: number;
    columns: number;
  };
  months: Section<{ label: string; month: number }>;
  levels: Section<{ code_pattern: string; level: ProductLevel }>;
  cities: Section<{ source_name: string; code: string; region_code: string | null }>;
}

export const NATIONAL = "national";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function entriesOf(value: unknown, section: string): Record<string, unknown>[] {
  const entries = isRecord(value) && isRecord(value[section]) ? value[section].entries : undefined;
  if (!Array.isArray(entries) || !entries.length || !entries.every(isRecord)) {
    throw new Error(`Invalid CPI mapping section '${section}'`);
  }
  return entries;
}

export function assertCpiMappings(value: unknown): asserts value is CpiMappings {
  const sections = ["cities", "levels", "months", "sheet"];
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== sections.join("|")) {
    throw new Error("Invalid CPI mapping file");
  }
  const sheet = value.sheet;
  if (!isRecord(sheet) || !isText(sheet.name) || !isText(sheet.title) || !Array.isArray(sheet.label_columns) ||
    sheet.label_columns.length !== 2 || !sheet.label_columns.every(isText) ||
    !isCount(sheet.header_rows) || !isCount(sheet.rows) || !isCount(sheet.columns)) {
    throw new Error("Invalid CPI mapping section 'sheet'");
  }
  if (!entriesOf(value, "months").every((entry) => isText(entry.label) &&
    typeof entry.month === "number" && Number.isInteger(entry.month) && entry.month >= 1 && entry.month <= 12)) {
    throw new Error("Invalid CPI month mapping");
  }
  if (!entriesOf(value, "levels").every((entry) => isText(entry.code_pattern) &&
    PRODUCT_LEVELS.includes(entry.level as ProductLevel))) {
    throw new Error("Invalid CPI level mapping");
  }
  if (!entriesOf(value, "cities").every((entry) => isText(entry.source_name) &&
    typeof entry.code === "string" && /^[a-z]+(?:-[a-z]+)*$/.test(entry.code) &&
    (entry.region_code === null || isText(entry.region_code)))) {
    throw new Error("Invalid CPI city mapping");
  }
}

/** Reads "<French month abbreviation>-<year>" header labels into YYYY-MM months. */
function parseMonths(labels: readonly unknown[], mappings: CpiMappings): string[] {
  const monthNumbers = new Map(mappings.months.entries.map((entry) => [entry.label, entry.month]));
  if (monthNumbers.size !== 12 || new Set(monthNumbers.values()).size !== 12) {
    throw new Error("CPI month mapping must list each calendar month once");
  }
  const months = labels.map((label, index) => {
    const match = typeof label === "string" ? /^(.+)-(\d{4})$/.exec(label) : null;
    const month = match ? monthNumbers.get(match[1]!) : undefined;
    if (!match || month === undefined) throw new Error(`Unexpected CPI month header '${String(label)}' in column ${index + 3}`);
    return `${match[2]}-${String(month).padStart(2, "0")}`;
  });
  // The source lists months newest first; each column must be the month before the previous one.
  for (let index = 1; index < months.length; index++) {
    const [year, month] = months[index - 1]!.split("-").map(Number) as [number, number];
    const expected = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
    if (months[index] !== expected) throw new Error(`CPI month columns are not consecutive at '${String(labels[index])}'`);
  }
  return months.reverse();
}

/**
 * Builds the published CPI series from the verbatim sheet rows and the mapping file. Every city
 * mapping must be used, every product code must keep one label and one parent, and every value must
 * be a positive number, so a changed source or a stale mapping stops the build instead of being hidden.
 */
export function buildCpiSnapshot(
  rows: readonly CpiRow[],
  mappings: CpiMappings,
  regionCodes: ReadonlySet<string>,
): CpiData {
  const { sheet } = mappings;
  if (rows.length !== sheet.rows) throw new Error(`CPI sheet must have ${sheet.rows} rows, found ${rows.length}`);
  rows.forEach((row, index) => {
    if (!Array.isArray(row) || row.length !== sheet.columns) throw new Error(`CPI row ${index + 1} must have ${sheet.columns} cells`);
  });
  if (rows[0]![0] !== sheet.title || rows[0]!.slice(1).some((cell) => cell !== null)) {
    throw new Error("Unexpected CPI sheet title row");
  }
  const header = rows[1]!;
  if (header[0] !== sheet.label_columns[0] || header[1] !== sheet.label_columns[1]) {
    throw new Error("Unexpected CPI label columns");
  }
  const months = parseMonths(header.slice(2), mappings);

  const cityMappings = new Map(mappings.cities.entries.map((entry) => [entry.source_name, entry]));
  if (cityMappings.size !== mappings.cities.entries.length ||
    new Set(mappings.cities.entries.map((entry) => entry.code)).size !== cityMappings.size) {
    throw new Error("Duplicate CPI city mapping");
  }
  const levels = mappings.levels.entries.map((entry) => ({ pattern: new RegExp(entry.code_pattern), level: entry.level }));

  const products = new Map<string, { name: string; level: ProductLevel; order: number; cities: Set<string> }>();
  const cityOrder: string[] = [];
  const series: CpiSeries[] = [];
  let lastProductOrder = -1;
  for (const [offset, row] of rows.slice(sheet.header_rows).entries()) {
    const rowNumber = offset + sheet.header_rows + 1;
    const [cityLabel, productLabel] = row;
    const city = typeof cityLabel === "string" ? cityMappings.get(cityLabel) : undefined;
    if (!city) throw new Error(`Unmapped CPI city '${String(cityLabel)}' in row ${rowNumber}`);
    if (cityOrder.at(-1) !== city.code) {
      if (cityOrder.includes(city.code)) throw new Error(`CPI city '${city.source_name}' is not contiguous (row ${rowNumber})`);
      cityOrder.push(city.code);
      lastProductOrder = -1;
    }

    const match = typeof productLabel === "string" ? /^\(([0-9A-Z]+)\) (.+)$/.exec(productLabel) : null;
    if (!match) throw new Error(`Unexpected CPI product label in row ${rowNumber}`);
    const code = match[1]!;
    const name = match[2]!;
    const level = levels.filter(({ pattern }) => pattern.test(code));
    if (level.length !== 1) throw new Error(`CPI product code '${code}' must match exactly one level (row ${rowNumber})`);

    let product = products.get(code);
    if (!product) {
      if (city.code !== NATIONAL) throw new Error(`CPI product '${code}' first appears outside the national index (row ${rowNumber})`);
      product = { name, level: level[0]!.level, order: products.size, cities: new Set() };
      products.set(code, product);
    } else if (product.name !== name) {
      throw new Error(`CPI product '${code}' has two labels (row ${rowNumber})`);
    }
    if (product.cities.has(city.code)) throw new Error(`Duplicate CPI series '${city.code}' '${code}' (row ${rowNumber})`);
    if (product.order <= lastProductOrder) throw new Error(`CPI products for '${city.code}' are out of order (row ${rowNumber})`);
    lastProductOrder = product.order;
    product.cities.add(city.code);

    const values = row.slice(2).map((cell, index) => {
      if (typeof cell !== "number" || !Number.isFinite(cell) || cell <= 0) {
        throw new Error(`Invalid CPI value for '${city.code}' '${code}' in ${months[months.length - 1 - index]}`);
      }
      return cell;
    }).reverse();
    series.push({ city_code: city.code, product_code: code, values });
  }

  const unused = mappings.cities.entries.filter((entry) => !cityOrder.includes(entry.code));
  if (unused.length) throw new Error(`Unused CPI city mappings: ${unused.map((entry) => entry.source_name).join(", ")}`);
  if (cityOrder[0] !== NATIONAL) throw new Error("The CPI sheet must start with the national index");

  const parentOf = (code: string) => (code === "GR" ? null : code.length === 2 ? "GR" : code.slice(0, -1));
  const productList: CpiProduct[] = [...products.entries()].map(([code, product]) => {
    const parent = parentOf(code);
    if (parent !== null && !products.has(parent)) throw new Error(`CPI product '${code}' has no parent '${parent}'`);
    if (product.level === "general" ? parent !== null : products.get(parent!)!.level !==
      PRODUCT_LEVELS[PRODUCT_LEVELS.indexOf(product.level) - 1]) {
      throw new Error(`CPI product '${code}' does not sit one level below its parent`);
    }
    return { code, name: product.name, level: product.level, parent_code: parent, city_count: product.cities.size - 1 };
  });

  const cities: CpiCity[] = cityOrder.map((code) => {
    const entry = mappings.cities.entries.find((city) => city.code === code)!;
    if ((code === NATIONAL) !== (entry.region_code === null)) {
      throw new Error(`CPI city '${code}' must have a region unless it is the national index`);
    }
    if (entry.region_code !== null && !regionCodes.has(entry.region_code)) {
      throw new Error(`Unknown region '${entry.region_code}' for CPI city '${code}'`);
    }
    return {
      code, name: entry.source_name, region_code: entry.region_code,
      product_count: series.filter((item) => item.city_code === code).length,
      first_month: months[0]!, last_month: months.at(-1)!,
    };
  });

  return { months, cities, products: productList, series };
}
