import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { assertWorldBankMappings, loadWorldBank } from "../../src/world-bank/data/indicators.js";
import { parseCsv } from "../../src/world-bank/data/csv.js";
import {
  assertSourceMetadata, buildWorldBankSnapshot, topicCode,
  type SourceMetadata, type WorldBankMappings,
} from "../../src/world-bank/data/transform.js";
import { buildDatasetMeta, WDI_LAST_UPDATED } from "../../src/world-bank/metadata.js";
import type { WorldBankData } from "../../src/world-bank/types.js";

let data: WorldBankData;
let csv: string;
let metadata: SourceMetadata[];
let mappings: WorldBankMappings;

const read = (name: string) => readFile(new URL(`../../data/world-bank/${name}`, import.meta.url), "utf8");
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

before(async () => {
  data = await loadWorldBank();
  csv = await read("source/API_MAR_DS2_en_csv_v2.csv");
  const rawMetadata: unknown = JSON.parse(await read("source/indicator-metadata.json"));
  assertSourceMetadata(rawMetadata);
  metadata = rawMetadata;
  const rawMappings: unknown = JSON.parse(await read("mappings.json"));
  assertWorldBankMappings(rawMappings);
  mappings = rawMappings;
});

describe("world-bank/data", () => {
  it("publishes the documented coverage as immutable records", () => {
    assert.equal(data.indicators.length, 1362);
    assert.equal(data.indicators.reduce((sum, indicator) => sum + indicator.value_count, 0), 46433);
    assert.equal(data.topics.length, 13);
    assert.equal(data.topics.reduce((sum, topic) => sum + topic.indicator_count, 0), 1362);
    assert.ok(Object.isFrozen(data.indicators) && Object.isFrozen(data.topics) && Object.isFrozen(data.excluded));
    assert.ok(data.indicators.every((indicator) => Object.isFrozen(indicator) && Object.isFrozen(indicator.values)));
  });

  it("matches the checksums and coverage recorded in the source manifest", async () => {
    const manifest = await readFile(new URL("../../sources/world-bank/wdi-morocco.yml", import.meta.url), "utf8");
    const files = [...manifest.matchAll(/raw_file: (\S+)\n\s+raw_file_sha256: ([0-9a-f]{64})/g)];
    assert.deepEqual(files.map((match) => match[1]), [
      "data/world-bank/source/API_MAR_DS2_en_csv_v2.csv", "data/world-bank/source/indicator-metadata.json",
    ]);
    for (const [, path, expected] of files) {
      const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
    }
    const coverage = (key: string) => Number(manifest.match(new RegExp(`\\n  ${key}: (\\d+)`))?.[1]);
    assert.equal(coverage("indicators_in_csv"), metadata.length);
    assert.equal(coverage("published_indicators"), data.indicators.length);
    assert.equal(coverage("published_values"), data.indicators.reduce((sum, indicator) => sum + indicator.value_count, 0));
    assert.equal(coverage("excluded_indicators"), data.excluded.length);
    assert.equal(coverage("topics"), data.topics.length);
    assert.equal(coverage("indicators_without_values"), metadata.length - data.indicators.length - data.excluded.length);
    assert.match(manifest, new RegExp(`source_updated_at: ${WDI_LAST_UPDATED}`));
    assert.match(manifest, /pages: 1\n\s+per_page: 30000\n\s+total_entries: 21403\n\s+series: 1498/);
  });

  it("keeps the raw CSV as published apart from LF line endings, with the declared release date", () => {
    assert.ok(csv.startsWith('﻿"Data Source","World Development Indicators",'));
    assert.ok(!csv.includes("\r"));
    assert.match(csv, new RegExp(`"Last Updated Date","${WDI_LAST_UPDATED}"`));
    assert.equal(metadata.length, 1498);
  });

  it("publishes only CC BY 4.0 indicators with values, years in order and no invented gaps", () => {
    for (const indicator of data.indicators) {
      assert.equal(indicator.license, "CC-BY-4.0");
      assert.ok(indicator.values.length > 0 && indicator.values.length === indicator.value_count, indicator.code);
      assert.equal(indicator.first_year, indicator.values[0]!.year);
      assert.equal(indicator.last_year, indicator.values.at(-1)!.year);
      assert.ok(indicator.values.every((value, index, values) =>
        Number.isFinite(value.value) && (index === 0 || value.year > values[index - 1]!.year)), indicator.code);
    }
    const sources = new Map(metadata.map((entry) => [entry.code, entry.License_Type]));
    assert.ok(data.indicators.every((indicator) => sources.get(indicator.code) === "CC BY-4.0"));
  });

  it("excludes exactly the nine non-CC BY 4.0 indicators", () => {
    assert.deepEqual(data.excluded.map((entry) => entry.code), [
      "GD_WBL_OVL_ENF", "GD_WBL_OVL_LAW", "GD_WBL_OVL_SFR", "MS.MIL.MPRT.KD", "MS.MIL.XPND.CD",
      "MS.MIL.XPND.CN", "MS.MIL.XPND.GD.ZS", "MS.MIL.XPND.ZS", "MS.MIL.XPRT.KD",
    ]);
    assert.ok(data.excluded.every((entry) => entry.license_type !== "CC BY-4.0"));
    const published = new Set(data.indicators.map((indicator) => indicator.code));
    assert.ok(data.excluded.every((entry) => !published.has(entry.code)));
  });

  it("documents all retained raw license exceptions separately from the CC BY 4.0 API", async () => {
    const manifest = await readFile(new URL("../../sources/world-bank/wdi-morocco.yml", import.meta.url), "utf8");
    assert.match(manifest, /^license: CC-BY-4\.0$/m);
    assert.match(manifest, /^license_scope: Published API indicators only;.*raw snapshot has mixed per-indicator licenses/m);
    const bulkSource = manifest.match(/  - dataset: "World Development Indicators: Morocco bulk download"\n([\s\S]*?)(?=\n  - dataset:)/)?.[1];
    assert.ok(bulkSource);
    assert.match(bulkSource, /^    source_license: mixed-per-indicator$/m);
    assert.match(bulkSource, /^    raw_file: data\/world-bank\/source\/API_MAR_DS2_en_csv_v2\.csv$/m);
    const rawLicensing = manifest.match(/\nraw_licensing:\n([\s\S]*?)(?=\nsource_notes:)/)?.[1];
    assert.ok(rawLicensing);
    assert.match(rawLicensing, /^  license: mixed-per-indicator$/m);
    assert.match(rawLicensing, /^  metadata_file: data\/world-bank\/source\/indicator-metadata\.json$/m);
    assert.match(rawLicensing, /^  license_fields: \[License_Type, License_URL\]$/m);
    assert.match(rawLicensing, /^  metadata_resource_url: https:\/\/api\.worldbank\.org\/v2\/sources\/2\/series\/all\/metadata\?format=json&per_page=30000$/m);
    assert.match(rawLicensing, /^  exception_indicators: 9$/m);
    assert.match(rawLicensing, /^  exception_values: 307$/m);
    const exceptions = [...rawLicensing.matchAll(/^    - code: (\S+)\n      license_type: (.+)\n      license_url: (.+)\n(?:      terms_url: (.+)\n)?      value_count: (\d+)$/gm)]
      .map((match) => ({
        code: match[1]!, licenseType: match[2]!, licenseUrl: match[3]!,
        termsUrl: match[4] ?? match[3]!, valueCount: Number(match[5]),
      }));
    const byCode = new Map(metadata.map((entry) => [entry.code, entry]));
    const rawExceptions = metadata.filter((entry) => entry.License_Type !== "CC BY-4.0");
    assert.equal(rawExceptions.length, 9);
    assert.equal(metadata.length - rawExceptions.length, 1489);
    assert.match(rawLicensing, /^  default_license_indicators: 1489$/m);
    assert.deepEqual(exceptions.map((entry) => entry.code).sort(), rawExceptions.map((entry) => entry.code).sort());
    assert.deepEqual(exceptions.map((entry) => entry.code).sort(), mappings.excluded_indicators.entries.map((entry) => entry.code).sort());
    const rows = parseCsv(csv).filter((row) => row.some((cell) => cell !== "")).slice(3);
    const rowsByCode = new Map(rows.map((row) => [row[3]!, row]));
    const published = new Set(data.indicators.map((entry) => entry.code));
    const valuesByLicense = new Map<string, number>();
    for (const exception of exceptions) {
      const original = byCode.get(exception.code)!;
      assert.equal(exception.licenseType, original.License_Type, exception.code);
      assert.equal(exception.licenseUrl, original.License_URL, exception.code);
      assert.equal(new URL(exception.termsUrl).protocol, "https:", exception.code);
      const originalRow = rowsByCode.get(exception.code);
      assert.ok(originalRow, `${exception.code} retains its original raw row`);
      assert.equal(originalRow.slice(4).filter((value) => value !== "").length, exception.valueCount, exception.code);
      assert.ok(exception.valueCount > 0);
      assert.equal(published.has(exception.code), false, `${exception.code} remains excluded from the API`);
      valuesByLicense.set(exception.licenseType, (valuesByLicense.get(exception.licenseType) ?? 0) + exception.valueCount);
    }
    assert.equal(exceptions.reduce((sum, entry) => sum + entry.valueCount, 0), 307);
    assert.deepEqual([...valuesByLicense].sort(), [["CC BY 3.0 IGO", 3], ["SIPRI terms and conditions", 304]]);
    assert.equal(buildDatasetMeta(1).license, "CC-BY-4.0");
    assert.ok(data.indicators.every((entry) => entry.license === "CC-BY-4.0"));
  });

  it("carries attribution and the CSV name for a third-party indicator", () => {
    const internet = data.indicators.find((indicator) => indicator.code === "IT.NET.USER.ZS")!;
    assert.equal(internet.name, "Individuals using the Internet (% of population)");
    assert.equal(internet.topic_code, "infrastructure");
    assert.equal(internet.unit, "% of population");
    assert.match(internet.source, /International Telecommunication Union/);
    assert.match(internet.citation_note ?? "", /Please cite the International Telecommunication Union/);
    assert.deepEqual(internet.values.slice(-3), [{ year: 2022, value: 89.9 }, { year: 2023, value: 91 }, { year: 2024, value: 91.2 }]);
    const imports = data.indicators.find((indicator) => indicator.code === "BM.GSR.GNFS.CD")!;
    assert.equal(imports.name, "Imports of goods and services (BoP, current US$)");
  });

  it("derives URL-safe topic codes", () => {
    assert.equal(topicCode("Economic Policy & Debt"), "economic-policy-debt");
    assert.equal(topicCode("Social Protection & Labor"), "social-protection-labor");
    assert.deepEqual(data.topics.map((topic) => topic.code).slice(0, 3), ["economic-policy-debt", "education", "environment"]);
  });

  it("uses the same metadata envelope as the existing domains", () => {
    const meta = buildDatasetMeta(1);
    assert.deepEqual(Object.keys(meta).sort(), ["dataset", "license", "retrieved_at", "sources", "total", "transformation_version"]);
    assert.ok(meta.sources.every((source) => source.source_updated_at === WDI_LAST_UPDATED && source.producer === "The World Bank"));
  });
});

describe("world-bank/mapping safety", () => {
  const build = (text = csv, entries = metadata, map = mappings) => buildWorldBankSnapshot(text, entries, map);

  it("fails on an unused exclusion or a non-CC BY 4.0 license that is not listed", () => {
    const stale = copy(mappings);
    stale.excluded_indicators.entries = [...stale.excluded_indicators.entries,
      { code: "NOT.A.CODE", name: "x", license_type: "Custom", reason: "license_not_cc_by_4" }];
    assert.throws(() => build(csv, metadata, stale), /Unused World Bank exclusions: NOT.A.CODE/);
    const unlisted = copy(mappings);
    unlisted.excluded_indicators.entries = unlisted.excluded_indicators.entries.slice(1);
    assert.throws(() => build(csv, metadata, unlisted), /Unlisted World Bank license 'CC BY 3.0 IGO' for 'GD_WBL_OVL_ENF'/);
    const relicensed = copy(metadata);
    relicensed.find((entry) => entry.code === "IT.NET.USER.ZS")!.License_Type = "Custom terms";
    assert.throws(() => build(csv, relicensed), /Unlisted World Bank license 'Custom terms' for 'IT.NET.USER.ZS'/);
  });

  it("fails when an exclusion now has an allowed license", () => {
    const changed = copy(metadata);
    changed.find((entry) => entry.code === "MS.MIL.XPND.CD")!.License_Type = "CC BY-4.0";
    assert.throws(() => build(csv, changed), /exclusion 'MS.MIL.XPND.CD' has an allowed license/);
  });

  it("fails when CSV rows and metadata do not match one to one", () => {
    assert.throws(() => build(csv, metadata.filter((entry) => entry.code !== "IT.NET.USER.ZS")), /Missing World Bank metadata for 'IT.NET.USER.ZS'/);
    const extra = [...metadata, { ...metadata[0]!, code: "EXTRA.CODE" }];
    assert.throws(() => build(csv, extra), /metadata without CSV rows: EXTRA.CODE/);
    assert.throws(() => build(csv, [...metadata, metadata[0]!]), /Duplicate World Bank metadata/);
  });

  it("fails on a changed CSV layout, a duplicated indicator or a malformed value", () => {
    assert.throws(() => build(csv.replace('"Data Source"', '"Source"')), /data source line/);
    assert.throws(() => build(csv.replace('"Indicator Code"', '"Code"')), /Unexpected World Bank CSV header/);
    assert.throws(() => build(csv.replace('"1961"', '"1999"')), /consecutive years/);
    const row = csv.split("\n").find((line) => line.includes('"IT.NET.USER.ZS"'))!;
    assert.throws(() => build(`${csv}${row}\n`), /Duplicate World Bank indicator 'IT.NET.USER.ZS'/);
    assert.throws(() => build(csv.replace(row, row.replace('"91.2"', '"n/a"'))), /Invalid World Bank value for 'IT.NET.USER.ZS'/);
    assert.throws(() => build(csv.replace('"Morocco","MAR"', '"Algeria","DZA"')), /Invalid World Bank CSV row/);
  });

  it("rejects malformed metadata and mapping files", () => {
    const broken = copy(metadata) as unknown as Record<string, unknown>[];
    broken[0]!.License_Type = "";
    assert.throws(() => assertSourceMetadata(broken), /Invalid World Bank metadata entry at index 0/);
    assert.throws(() => assertWorldBankMappings({ allowed_licenses: { entries: [] } }), /Invalid World Bank mapping file/);
  });
});
