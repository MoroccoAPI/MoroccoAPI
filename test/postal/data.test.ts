import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";

import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import type { GeographySnapshot } from "../../src/geography/types.js";
import { loadPostal, validatePostalData } from "../../src/postal/data/postal-codes.js";
import { assertPostalSource, buildPostalSnapshot } from "../../src/postal/data/transform.js";
import { buildDatasetMeta } from "../../src/postal/metadata.js";

let geography: GeographySnapshot;
let rawCodes: Record<string, unknown>[];
let rawCities: Record<string, unknown>[];

before(async () => {
  const regions = await loadRegions();
  geography = Object.freeze({ regions, ...await loadGeography(regions) });
  const read = async (name: string) => JSON.parse(await readFile(new URL(`../../data/postal/${name}`, import.meta.url), "utf8"));
  const source = {
    localities: await read("source/localities.json"),
    cities: await read("source/multi-code-cities.json"),
    neighborhoods: await read("source/neighborhoods.json"),
  };
  assertPostalSource(source);
  const snapshot = buildPostalSnapshot(source, await read("mappings.json"), geography);
  rawCodes = JSON.parse(JSON.stringify(snapshot.codes));
  rawCities = JSON.parse(JSON.stringify(snapshot.cities));
});

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe("postal/data", () => {
  it("loads the documented coverage as immutable snapshots", async () => {
    const { postalCodes, cities } = await loadPostal(geography);
    assert.equal(postalCodes.filter((record) => record.type === "locality").length, 1770);
    assert.equal(postalCodes.filter((record) => record.type === "neighborhood").length, 9947);
    assert.equal(new Set(postalCodes.map((record) => record.postal_code)).size, 2035);
    assert.equal(cities.length, 34);
    assert.equal(cities.reduce((sum, city) => sum + city.neighborhood_count, 0), 9947);
    assert.ok(Object.isFrozen(postalCodes) && Object.isFrozen(cities));
    assert.ok(postalCodes.every(Object.isFrozen));
    assert.ok(cities.every((city) => Object.isFrozen(city) && Object.isFrozen(city.postal_codes)));
  });

  it("derives regions from provinces and links communes only inside the same province", async () => {
    const { postalCodes } = await loadPostal(geography);
    const provinces = new Map(geography.provinces.map((province) => [province.code, province]));
    const communes = new Map(geography.communes.map((commune) => [commune.code, commune]));
    for (const record of postalCodes) {
      assert.equal(record.region_code, provinces.get(record.province_code)?.region_code, record.name);
      if (record.commune_code !== null) {
        assert.equal(communes.get(record.commune_code)?.province_code, record.province_code, record.name);
      }
    }
    // The source labels JBIYEL with the Fès-Meknès postal region; its province decides.
    const jbiyel = postalCodes.find((record) => record.name === "JBIYEL");
    assert.deepEqual([jbiyel?.province_code, jbiyel?.region_code], ["errachidia", "draa-tafilalet"]);
    assert.equal(postalCodes.filter((record) => record.commune_code !== null).length, 938);
  });

  it("keeps both codes of a place and leaves excluded misfiled rows out", async () => {
    const { postalCodes } = await loadPostal(geography);
    const boustane = postalCodes.filter((record) => record.city === "RABAT" && record.name === "QUARTIER AL BOUSTANE");
    assert.deepEqual(boustane.map((record) => record.postal_code), ["10150", "10210"]);
    const louta = postalCodes.filter((record) => record.name === "OULAD YAHYA LOUTA");
    assert.deepEqual(louta.map((record) => record.postal_code), ["13012", "13035"]);
    assert.ok(!postalCodes.some((record) => record.city === "ERRACHIDIA" && record.postal_code === "12013"));
    assert.ok(!postalCodes.some((record) => record.city === "OUARZAZATE" && record.name === "DOUAR KARIAT BA MED"));
  });

  it("uses the same metadata envelope as the existing domains", () => {
    const meta = buildDatasetMeta(3);
    assert.deepEqual(Object.keys(meta).sort(), ["dataset", "license", "retrieved_at", "sources", "total", "transformation_version"]);
    assert.equal(meta.license, "ODbL-1.0");
    assert.ok(meta.sources.some((source) => source.producer === "Barid Al-Maghrib (Poste Maroc)"));
    for (const source of meta.sources) {
      assert.deepEqual(Object.keys(source).sort(), ["dataset", "license", "producer", "resource_url", "source_updated_at", "source_url"]);
    }
  });

  it("rejects malformed codes, broken geography, duplicates and misfiled neighbourhoods", () => {
    const reject = (codes: unknown, cities: unknown, pattern: RegExp) =>
      assert.throws(() => validatePostalData(codes, cities, geography), pattern);

    const malformed = copy(rawCodes);
    malformed[0]!.postal_code = "1000";
    reject(malformed, rawCities, /Invalid postal code record/);

    const locality = copy(rawCodes);
    locality.find((record) => record.type === "locality")!.city = "RABAT";
    reject(locality, rawCities, /Invalid postal code record/);

    const region = copy(rawCodes);
    region[0]!.region_code = "souss-massa";
    reject(region, rawCities, /province\/region/);

    const commune = copy(rawCodes);
    commune.find((record) => record.commune_code !== null)!.commune_code = "rabat--rabat";
    reject(commune, rawCities, /commune/);

    const duplicate = copy(rawCodes);
    duplicate.push(duplicate[0]!);
    reject(duplicate, rawCities, /Duplicate postal code record/);

    const city = copy(rawCodes);
    city.find((record) => record.type === "neighborhood")!.city = "PARIS";
    reject(city, rawCities, /multi-code city/);

    const misfiled = copy(rawCodes);
    misfiled.push({
      postal_code: "12013", type: "neighborhood", name: "DOUAR OLD SLAMA", city: "ERRACHIDIA",
      province_code: "errachidia", region_code: "draa-tafilalet", commune_code: null,
    });
    reject(misfiled, rawCities, /locality code from another province/);

    const cities = copy(rawCities);
    cities.push(cities[0]!);
    reject(rawCodes, cities, /Duplicate multi-code city/);
  });
});
