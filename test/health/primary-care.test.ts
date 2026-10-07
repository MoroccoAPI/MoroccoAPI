import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { after, before, describe, it, mock } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import { loadPrimaryCareFacilities } from "../../src/health/data/primary-care-facilities.js";
import type { PrimaryCareFacility } from "../../src/health/types.js";

const url = "/api/v1/health/primary-care-facilities";
let app: FastifyInstance;
let facilities: readonly PrimaryCareFacility[];

before(async () => {
  const regions = await loadRegions();
  facilities = await loadPrimaryCareFacilities(regions, await loadGeography(regions));
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("health/primary-care-facilities", () => {
  it("returns the complete national snapshot and its own source metadata", async () => {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 3065);
    assert.equal(body.meta.total, 3065);
    assert.equal(body.meta.dataset, "primary-care-facilities");
    assert.equal(body.meta.license, "ODbL-1.0");
    const geographyMeta = (await app.inject("/api/v1/regions")).json().meta;
    assert.deepEqual(Object.keys(body.meta).sort(), Object.keys(geographyMeta).sort());
    assert.equal(body.meta.sources.length, 2);
    assert.ok(body.meta.sources.some((source: { resource_url: string }) => source.resource_url.endsWith("etablissements-de-soins-de-sante-primaire-2024.xlsx")));
    assert.ok(!JSON.stringify(body.meta.sources).includes("geofabrik"));
    assert.deepEqual(body.data, facilities);
    assert.equal(new Set(body.data.map((record: PrimaryCareFacility) => record.id)).size, 3065);
  });

  it("combines all filters and searches official announcement aliases", async () => {
    const response = await app.inject(`${url}?region_code=fes-meknes&province_code=fes&category=CSU-1&q=Soundous`);
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].name, "Soundouss");
    assert.ok(body.data[0].aliases.includes("Soundous"));
    assert.equal(body.data[0].region_code, "fes-meknes");
    assert.equal(body.data[0].province_code, "fes");
    assert.equal(body.data[0].category, "CSU-1");
  });

  it("applies each geographic/category filter without requiring other filters", async () => {
    for (const [field, value, expectedTotal] of [
      ["region_code", "fes-meknes", 426],
      ["province_code", "jerada", 20],
      ["category", "DR", 859],
    ] as const) {
      const response = await app.inject(`${url}?${field}=${value}`);
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.meta.total, expectedTotal);
      assert.ok(body.data.every((record: PrimaryCareFacility) => record[field] === value));
    }
  });

  it("searches names without requiring accents or case", async () => {
    const response = await app.inject(`${url}?province_code=meknes&q=${encodeURIComponent("  OUM RABIA  ")}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 1);
    assert.equal(response.json().data[0].name, "Oum Rabiâ");
  });

  it("returns an empty collection for unmatched searches or incompatible filters", async () => {
    for (const query of ["region_code=fes-meknes&province_code=jerada", "q=does-not-exist-999"]) {
      const response = await app.inject(`${url}?${query}`);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json().data, []);
      assert.equal(response.json().meta.total, 0);
    }
  });

  it("keeps the national reference year distinct from commissioning confirmations", async () => {
    const records = (await app.inject(url)).json().data as PrimaryCareFacility[];
    assert.ok(records.every((record) => record.reference_year === 2024));
    const confirmed = records.filter((record) => record.last_service_event_date !== null);
    assert.equal(confirmed.length, 46);
    assert.ok(confirmed.every((record) => record.last_service_event_date!.startsWith("2026-")));
    assert.equal(records.find((record) => record.name === "Dar Bouazza")!.last_service_event_date, "2026-09-08");
    assert.ok(records.some((record) => record.last_service_event_date === null));
  });

  it("rejects invalid category, geography and search queries with consistent errors", async () => {
    for (const query of ["region_code=unknown", "province_code=unknown", "category=HP", "q=a", "q=%20%20", `q=${"a".repeat(101)}`]) {
      const response = await app.inject(`${url}?${query}`);
      assert.equal(response.statusCode, 400, query);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.equal(typeof response.json().error.request_id, "string");
    }
  });

  it("documents filters, categories, dates and errors in OpenAPI", async () => {
    const route = (await app.inject("/openapi.json")).json().paths[url].get;
    assert.deepEqual(route.parameters.map((parameter: { name: string }) => parameter.name).sort(), ["category", "province_code", "q", "region_code"]);
    const category = route.parameters.find((parameter: { name: string }) => parameter.name === "category");
    assert.deepEqual(category.schema.enum, ["CSU-1", "CSU-2", "CSR-1", "CSR-2", "DR"]);
    assert.ok(route.responses["400"]);
    const record = route.responses["200"].content["application/json"].schema.properties.data.items;
    assert.ok(record.properties.reference_year.description.includes("Reference year"));
    assert.ok(record.properties.last_service_event_date.anyOf.some((schema: { format?: string }) => schema.format === "date"));
  });
});

describe("health/primary-care data", () => {
  it("loads immutable records and rejects mutation of aliases", () => {
    assert.ok(Object.isFrozen(facilities));
    const withAliases = facilities.find((record) => record.aliases.length > 0)!;
    assert.ok(Object.isFrozen(withAliases));
    assert.ok(Object.isFrozen(withAliases.aliases));
    assert.throws(() => (withAliases.aliases as string[]).push("unverified"), TypeError);
  });

  it("rejects malformed records, duplicate IDs and invalid parent geography", async () => {
    const regions = await loadRegions();
    const geography = await loadGeography(regions);
    const valid = facilities[0]!;
    const otherProvince = facilities.find((record) => record.province_code !== valid.province_code)!;
    const otherArrondissement = geography.arrondissements.find((record) => record.commune_code !== valid.commune_code)!;
    for (const [records, error] of [
      [[], /must contain records/],
      [[{ ...valid, category: "HP" }], /Invalid primary-care facility record/],
      [[{ ...valid, reference_year: null }], /Invalid primary-care facility record/],
      [[{ ...valid, last_service_event_date: "2026-02-30" }], /Invalid primary-care facility record/],
      [[valid, valid], /Duplicate primary-care facility ID/],
      [[{ ...valid, region_code: "unknown" }], /province\/region relationship/],
      [[{ ...valid, commune_code: otherProvince.commune_code }], /Invalid primary-care facility commune/],
      [[{ ...valid, arrondissement_code: otherArrondissement.code }], /Invalid primary-care facility arrondissement/],
    ] as const) {
      const mockedRead = mock.method(fs, "readFile", async () => JSON.stringify(records));
      syncBuiltinESMExports();
      try {
        await assert.rejects(loadPrimaryCareFacilities(regions, geography), error);
      } finally {
        mockedRead.mock.restore();
        syncBuiltinESMExports();
      }
    }
  });
});
