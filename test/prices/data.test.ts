import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { loadCpi, loadCpiMappings, loadCpiRows } from "../../src/prices/data/cpi.js";
import { assertCpiMappings, buildCpiSnapshot, type CpiMappings, type CpiRow } from "../../src/prices/data/transform.js";
import { buildDatasetMeta } from "../../src/prices/metadata.js";
import type { CpiData } from "../../src/prices/types.js";

let geography: GeographySnapshot;
let data: CpiData;
let rows: CpiRow[];
let mappings: CpiMappings;
let regionCodes: Set<string>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const mutable = (source: readonly CpiRow[]) => copy(source) as (string | number | null)[][];
const rowIndex = (city: string, code: string) => rows.findIndex((row) => row[0] === city && String(row[1]).startsWith(`(${code}) `));
const series = (city: string, product: string) => data.series.find((item) => item.city_code === city && item.product_code === product);

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  regionCodes = new Set(regions.map((region) => region.code));
  [rows, mappings, data] = await Promise.all([loadCpiRows(), loadCpiMappings(), loadCpi(geography)]);
});

describe("prices/cpi data", () => {
  it("publishes 116 months, 19 series areas, 148 products and every source series", () => {
    assert.equal(data.months.length, 116);
    assert.equal(data.months[0], "2017-01");
    assert.equal(data.months.at(-1), "2026-08");
    assert.deepEqual(data.cities.map((city) => city.code), [
      "national", "agadir", "casablanca", "fes", "kenitra", "marrakech", "oujda", "rabat", "tetouan", "meknes",
      "tanger", "laayoune", "dakhla", "guelmim", "settat", "safi", "beni-mellal", "al-hoceima", "errachidia",
    ]);
    const levels = new Map<string, number>();
    for (const product of data.products) levels.set(product.level, (levels.get(product.level) ?? 0) + 1);
    assert.deepEqual(Object.fromEntries(levels), { general: 1, division: 12, group: 43, class: 92 });
    assert.equal(data.series.length, 2744);
    assert.ok(data.series.every((item) => item.values.length === 116));
    assert.deepEqual(
      Object.fromEntries(data.cities.filter((city) => city.product_count < 148).map((city) => [city.code, city.product_count])),
      { agadir: 147, tetouan: 140, meknes: 147, laayoune: 140, dakhla: 130, guelmim: 139, safi: 145, "beni-mellal": 138, "al-hoceima": 141, errachidia: 145 },
    );
  });

  it("matches the checksums and coverage recorded in the source manifest", async () => {
    const manifest = await readFile(new URL("../../sources/prices/cpi-monthly.yml", import.meta.url), "utf8");
    const files = [...manifest.matchAll(/- file: (\S+)\n\s+sha256: ([0-9a-f]{64})/g)];
    assert.deepEqual(files.map((match) => match[1]), ["data/prices/source/cpi-monthly.json", "data/prices/cpi-mappings.json"]);
    for (const [, path, expected] of files) {
      const bytes = await readFile(new URL(`../../${path}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, path);
    }
    const coverage = (key: string) => manifest.match(new RegExp(`\\n  ${key}: (\\S+)`))?.[1];
    assert.equal(coverage("first_month"), data.months[0]);
    assert.equal(coverage("last_month"), data.months.at(-1));
    assert.equal(Number(coverage("months")), data.months.length);
    assert.equal(Number(coverage("series_areas")), data.cities.length);
    assert.equal(Number(coverage("products")), data.products.length);
    assert.equal(Number(coverage("classes")), data.products.filter((product) => product.level === "class").length);
    assert.equal(Number(coverage("series")), data.series.length);
    assert.equal(Number(coverage("values")), data.series.reduce((sum, item) => sum + item.values.length, 0));
    assert.equal(Number(manifest.match(/\n    source_rows: (\d+)\n/)?.[1]), rows.length);
    const meta = buildDatasetMeta(0);
    assert.match(manifest, new RegExp(`\\nretrieved_at: ${meta.retrieved_at}\\n`));
    assert.match(manifest, new RegExp(`\\n    source_updated_at: ${meta.sources[0].source_updated_at}\\n`));
    assert.match(manifest, new RegExp(`\\n    resource_url: ${meta.sources[0].resource_url}\\n`));
    assert.match(manifest, new RegExp(`\\nversion: ${meta.transformation_version}\\n`));
  });

  it("keeps the source sheet verbatim, newest month first", () => {
    assert.equal(rows.length, 2746);
    assert.ok(rows.every((row) => row.length === 118));
    assert.equal(rows[0]![0], "Indice des prix à la consommation (Mensuel) (Base 100 2017) (Indice)");
    assert.deepEqual(rows[1]!.slice(0, 4), ["Villes", "Divisions et groupes de produits", "Août-2026", "Juill-2026"]);
    assert.equal(rows[1]!.at(-1), "Janv-2017");
    assert.deepEqual(rows[2]!.slice(0, 5), ["National", "(GR) GENERAL", 119.6, 118.7, 119.9]);
  });

  it("publishes the values recorded by HCP, oldest first", () => {
    const national = series("national", "GR")!;
    assert.deepEqual(national.values.slice(-3), [119.9, 118.7, 119.6]);
    assert.equal(national.values[data.months.indexOf("2026-02")], 119.6);
    assert.equal(national.values[data.months.indexOf("2026-01")], 119.0);
    assert.equal(national.values[0], 99.4);
    const source = rows[rowIndex("Casablanca", "0112")]!;
    assert.deepEqual(series("casablanca", "0112")!.values, source.slice(2).reverse());
    assert.equal(series("dakhla", "021"), undefined);
  });

  it("averages 100 over 2017 for every series, as expected for base 2017", () => {
    for (const item of data.series) {
      const average = item.values.slice(0, 12).reduce((sum, value) => sum + value, 0) / 12;
      assert.ok(Math.abs(average - 100) <= 0.05, `${item.city_code} ${item.product_code}: ${average}`);
    }
  });

  it("links products to their parent and cities to an existing region", () => {
    const byCode = new Map(data.products.map((product) => [product.code, product]));
    assert.deepEqual(data.products[0], { code: "GR", name: "GENERAL", level: "general", parent_code: null, city_count: 18 });
    assert.deepEqual(byCode.get("0118"), {
      code: "0118", name: "SUCRE, CONFITURE, MIEL, CHOCOLAT ET CONFESERIE", level: "class", parent_code: "011", city_count: 18,
    });
    assert.equal(byCode.get("0731")!.city_count, 10);
    assert.deepEqual(data.cities.filter((city) => !series(city.code, "0731")).map((city) => city.code),
      ["agadir", "tetouan", "laayoune", "dakhla", "guelmim", "beni-mellal", "al-hoceima", "errachidia"]);
    for (const product of data.products) {
      if (product.parent_code !== null) assert.ok(byCode.has(product.parent_code), product.code);
    }
    assert.equal(data.cities[0]!.region_code, null);
    assert.ok(data.cities.slice(1).every((city) => city.region_code !== null && regionCodes.has(city.region_code)));
    assert.equal(data.cities.find((city) => city.code === "errachidia")!.region_code, "draa-tafilalet");
  });

  it("returns an immutable snapshot", () => {
    assert.ok(Object.isFrozen(data) && Object.isFrozen(data.months) && Object.isFrozen(data.series));
    assert.ok(data.cities.every(Object.isFrozen) && data.products.every(Object.isFrozen));
    assert.ok(data.series.every((item) => Object.isFrozen(item) && Object.isFrozen(item.values)));
  });
});

describe("prices/cpi mapping safety", () => {
  const build = (source: readonly CpiRow[] = rows, map: CpiMappings = mappings) => buildCpiSnapshot(source, map, regionCodes);

  it("fails on a changed title, label column, month header or row count", () => {
    const title = mutable(rows);
    title[0]![0] = "Autre titre";
    assert.throws(() => build(title), /Unexpected CPI sheet title row/);
    const label = mutable(rows);
    label[1]![1] = "Produits";
    assert.throws(() => build(label), /Unexpected CPI label columns/);
    const unknown = mutable(rows);
    unknown[1]![2] = "August-2026";
    assert.throws(() => build(unknown), /Unexpected CPI month header 'August-2026'/);
    const gap = mutable(rows);
    gap[1]![3] = "Juin-2026";
    assert.throws(() => build(gap), /not consecutive at 'Juin-2026'/);
    assert.throws(() => build(rows.slice(0, -1)), /must have 2746 rows/);
  });

  it("fails on an unmapped city, an unused mapping or an unknown region", () => {
    const city = mutable(rows);
    city[rowIndex("Safi", "GR")]![0] = "Nador";
    assert.throws(() => build(city), /Unmapped CPI city 'Nador'/);
    const extra = copy(mappings);
    extra.cities.entries = [...extra.cities.entries, { source_name: "Nador", code: "nador", region_code: "oriental" }];
    assert.throws(() => build(rows, extra), /Unused CPI city mappings: Nador/);
    const region = copy(mappings);
    region.cities.entries = region.cities.entries.map((entry) => entry.code === "safi" ? { ...entry, region_code: "atlantis" } : entry);
    assert.throws(() => build(rows, region), /Unknown region 'atlantis' for CPI city 'safi'/);
  });

  it("fails on a relabelled, duplicated, unordered or orphan product", () => {
    const relabel = mutable(rows);
    relabel[rowIndex("Rabat", "0112")]![1] = "(0112) VIANDES";
    assert.throws(() => build(relabel), /CPI product '0112' has two labels/);
    const duplicate = mutable(rows);
    duplicate[rowIndex("Rabat", "0113")]![1] = duplicate[rowIndex("Rabat", "0112")]![1]!;
    assert.throws(() => build(duplicate), /Duplicate CPI series 'rabat' '0112'/);
    const swapped = mutable(rows);
    const index = rowIndex("Oujda", "0112");
    [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
    assert.throws(() => build(swapped), /CPI products for 'oujda' are out of order/);
    const orphan = mutable(rows);
    for (const row of orphan) if (row[1] === "(0112) VIANDE") row[1] = "(0192) VIANDE";
    assert.throws(() => build(orphan), /CPI product '0192' has no parent '019'/);
    const local = mutable(rows);
    local[rowIndex("Tanger", "0112")]![1] = "(0199) VIANDE";
    assert.throws(() => build(local), /CPI product '0199' first appears outside the national index/);
  });

  it("fails on a missing, textual or non-positive value", () => {
    for (const value of [null, "119,6", 0, -1]) {
      const changed = mutable(rows);
      changed[rowIndex("Fès", "GR")]![2] = value;
      assert.throws(() => build(changed), /Invalid CPI value for 'fes' 'GR' in 2026-08/, String(value));
    }
  });

  it("rejects malformed mapping files", () => {
    assert.throws(() => assertCpiMappings({ sheet: {} }), /Invalid CPI mapping file/);
    const month = copy(mappings) as unknown as { months: { entries: Record<string, unknown>[] } };
    month.months.entries[0]!.month = 13;
    assert.throws(() => assertCpiMappings(month), /Invalid CPI month mapping/);
    const level = copy(mappings) as unknown as { levels: { entries: Record<string, unknown>[] } };
    level.levels.entries[0]!.level = "family";
    assert.throws(() => assertCpiMappings(level), /Invalid CPI level mapping/);
    const code = copy(mappings) as unknown as { cities: { entries: Record<string, unknown>[] } };
    code.cities.entries[1]!.code = "Agadir";
    assert.throws(() => assertCpiMappings(code), /Invalid CPI city mapping/);
    const repeated = copy(mappings);
    repeated.months.entries = repeated.months.entries.map((entry) => entry.month === 12 ? { ...entry, month: 11 } : entry);
    assert.throws(() => build(rows, repeated), /must list each calendar month once/);
  });
});
