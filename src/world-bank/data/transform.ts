import type { ExcludedIndicator, Indicator, IndicatorValue, Topic } from "../types.js";
import { parseCsv } from "./csv.js";

/** One entry of data/world-bank/source/indicator-metadata.json (World Bank field names, values unchanged). */
export interface SourceMetadata {
  code: string;
  IndicatorName: string;
  Topic: string;
  Unitofmeasure: string | null;
  Periodicity: string | null;
  Source: string;
  License_Type: string;
  License_URL: string;
  Othernotes: string | null;
  Shortdefinition: string | null;
}

interface Section<T> {
  description: string;
  entries: readonly T[];
}

export interface WorldBankMappings {
  allowed_licenses: Section<{ license_type: string; license: "CC-BY-4.0" }>;
  excluded_indicators: Section<{ code: string; name: string; license_type: string; reason: "license_not_cc_by_4" }>;
}

export interface WorldBankSnapshot {
  lastUpdated: string;
  indicators: Indicator[];
  topics: Topic[];
  excluded: ExcludedIndicator[];
  emptyIndicators: number;
}

const FIXED_COLUMNS = ["Country Name", "Country Code", "Indicator Name", "Indicator Code"] as const;

/** URL-safe topic identifier, e.g. "Economic Policy & Debt" → "economic-policy-debt". */
export function topicCode(name: string): string {
  return name.normalize("NFD").replace(/[^\u0000-\u007f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isNullableText = (value: unknown): value is string | null => value === null || isText(value);

export function assertSourceMetadata(value: unknown): asserts value is SourceMetadata[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("World Bank metadata must contain entries");
  value.forEach((entry: unknown, index) => {
    if (!isRecord(entry) || !isText(entry.code) || !isText(entry.IndicatorName) || !isText(entry.Topic) ||
      !isNullableText(entry.Unitofmeasure) || !isNullableText(entry.Periodicity) || !isText(entry.Source) ||
      !isText(entry.License_Type) || !isText(entry.License_URL) || !isNullableText(entry.Othernotes) ||
      !isNullableText(entry.Shortdefinition)) {
      throw new Error(`Invalid World Bank metadata entry at index ${index}`);
    }
  });
}

/**
 * Builds the published indicators from the verbatim bulk CSV, the metadata subset and the mapping file.
 * Every mapping entry must be used and every non-allowed license must be listed, so a changed source
 * or a stale mapping stops the build instead of being hidden.
 */
export function buildWorldBankSnapshot(
  csvText: string,
  metadata: readonly SourceMetadata[],
  mappings: WorldBankMappings,
): WorldBankSnapshot {
  const rows = parseCsv(csvText).filter((row) => row.some((cell) => cell !== ""));
  if (rows[0]?.[0] !== "Data Source" || rows[0][1] !== "World Development Indicators") {
    throw new Error("World Bank CSV must start with the World Development Indicators data source line");
  }
  if (rows[1]?.[0] !== "Last Updated Date" || !/^\d{4}-\d{2}-\d{2}$/.test(rows[1][1] ?? "")) {
    throw new Error("World Bank CSV must state its last updated date");
  }
  const lastUpdated = rows[1][1]!;
  const header = rows[2] ?? [];
  if (FIXED_COLUMNS.some((name, index) => header[index] !== name)) {
    throw new Error("Unexpected World Bank CSV header");
  }
  const yearColumns = header.slice(FIXED_COLUMNS.length);
  while (yearColumns.at(-1) === "") yearColumns.pop();
  const years = yearColumns.map(Number);
  if (!years.length || years.some((year, index) => !Number.isInteger(year) || String(year) !== yearColumns[index] ||
    (index > 0 && year !== years[index - 1]! + 1))) {
    throw new Error("World Bank CSV year columns must be consecutive years");
  }

  const metadataByCode = new Map<string, SourceMetadata>();
  for (const entry of metadata) {
    if (metadataByCode.has(entry.code)) throw new Error(`Duplicate World Bank metadata for '${entry.code}'`);
    metadataByCode.set(entry.code, entry);
  }
  const allowed = new Map(mappings.allowed_licenses.entries.map((entry) => [entry.license_type, entry.license]));
  const exclusions = new Map(mappings.excluded_indicators.entries.map((entry) => [entry.code, entry]));
  const usedExclusions = new Set<string>();

  const indicators: Indicator[] = [];
  const excluded: ExcludedIndicator[] = [];
  const seen = new Set<string>();
  let emptyIndicators = 0;
  for (const [index, row] of rows.slice(3).entries()) {
    const [country, countryCode, name, code] = row;
    if (country !== "Morocco" || countryCode !== "MAR" || !isText(name) || !isText(code)) {
      throw new Error(`Invalid World Bank CSV row ${index + 1}`);
    }
    const key = code.toUpperCase();
    if (seen.has(key)) throw new Error(`Duplicate World Bank indicator '${code}'`);
    seen.add(key);
    if (row.slice(FIXED_COLUMNS.length + years.length).some((cell) => cell !== "")) {
      throw new Error(`World Bank indicator '${code}' has values outside the year columns`);
    }

    const values: IndicatorValue[] = [];
    years.forEach((year, offset) => {
      const cell = row[FIXED_COLUMNS.length + offset] ?? "";
      if (cell === "") return;
      const value = Number(cell);
      if (!Number.isFinite(value) || cell.trim() !== cell) {
        throw new Error(`Invalid World Bank value for '${code}' in ${year}`);
      }
      values.push({ year, value });
    });

    const entry = metadataByCode.get(code);
    if (!entry) throw new Error(`Missing World Bank metadata for '${code}'`);
    // The name comes from the bulk CSV, which carries the values; the metadata API words some names differently.
    metadataByCode.delete(code);

    const license = allowed.get(entry.License_Type);
    const exclusion = exclusions.get(code);
    if (license === undefined) {
      if (!exclusion || exclusion.license_type !== entry.License_Type) {
        throw new Error(`Unlisted World Bank license '${entry.License_Type}' for '${code}'`);
      }
      usedExclusions.add(code);
      excluded.push({ code, name, license_type: entry.License_Type });
      continue;
    }
    if (exclusion) throw new Error(`World Bank exclusion '${code}' has an allowed license`);
    if (!values.length) {
      emptyIndicators++;
      continue;
    }

    const topic = entry.Topic.split(":")[0]!.trim();
    indicators.push({
      code, name, topic_code: topicCode(topic), topic: entry.Topic,
      unit: entry.Unitofmeasure, periodicity: entry.Periodicity, source: entry.Source,
      license, license_url: entry.License_URL, citation_note: entry.Othernotes,
      first_year: values[0]!.year, last_year: values.at(-1)!.year, value_count: values.length,
      definition: entry.Shortdefinition, values,
    });
  }

  if (metadataByCode.size) {
    throw new Error(`World Bank metadata without CSV rows: ${[...metadataByCode.keys()].slice(0, 5).join(", ")}`);
  }
  const unused = [...exclusions.keys()].filter((code) => !usedExclusions.has(code));
  if (unused.length) throw new Error(`Unused World Bank exclusions: ${unused.join(", ")}`);

  const topicCounts = new Map<string, Topic>();
  for (const indicator of indicators) {
    const name = indicator.topic.split(":")[0]!.trim();
    const topic = topicCounts.get(indicator.topic_code) ?? { code: indicator.topic_code, name, indicator_count: 0 };
    if (topic.name !== name) throw new Error(`World Bank topic code '${topic.code}' is ambiguous`);
    topic.indicator_count++;
    topicCounts.set(topic.code, topic);
  }

  const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  return {
    lastUpdated,
    indicators: indicators.sort(byCode),
    topics: [...topicCounts.values()].sort(byCode),
    excluded: excluded.sort(byCode),
    emptyIndicators,
  };
}
