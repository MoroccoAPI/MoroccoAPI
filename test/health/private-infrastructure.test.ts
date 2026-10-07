import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { after, before, describe, it, mock } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadRegions } from "../../src/geography/data/regions.js";
import { loadPrivateInfrastructure } from "../../src/health/data/private-infrastructure.js";
import type { PrivateInfrastructure } from "../../src/health/types.js";

const url = "/api/v1/health/private-infrastructure";
let app: FastifyInstance;
let records: readonly PrivateInfrastructure[];

before(async () => {
  records = await loadPrivateInfrastructure(await loadRegions());
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("health/private-infrastructure", () => {
  it("returns national and regional indicators with the Geography metadata envelope", async () => {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 13);
    assert.equal(body.meta.total, 13);
    assert.equal(body.meta.dataset, "private-infrastructure");
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.deepEqual(body.data, records);
    const geographyMeta = (await app.inject("/api/v1/regions")).json().meta;
    assert.deepEqual(Object.keys(body.meta).sort(), Object.keys(geographyMeta).sort());
    assert.equal(body.meta.sources.length, 3);
    assert.ok(body.meta.sources.some((source: { resource_url: string }) => source.resource_url.endsWith("infrastructures-privees-2024.xlsx")));
    assert.ok(body.meta.sources.some((source: { resource_url: string; license: string }) => source.resource_url === "https://www.hcp.ma/file/248623/" && source.license === "CC-BY-4.0"));
    for (const source of body.meta.sources) {
      assert.deepEqual(Object.keys(source).sort(), Object.keys(geographyMeta.sources[0]).sort());
    }
  });

  it("preserves all nine official national indicators and their reference year", async () => {
    const body = (await app.inject(url)).json();
    const national = body.data.filter((record: PrivateInfrastructure) => record.geographic_level === "national");
    assert.deepEqual(national, [{
      geographic_level: "national", region_code: null, reference_year: 2024,
      clinics: 453, dental_practices: 6183, medical_practices: 14524, radiology_practices: 383,
      hemodialysis_centres: 280, physiotherapy_centres: 1063, analysis_laboratories: 773,
      pharmacies: 10319, infirmaries: 669,
    }]);
    assert.ok(body.data.every((record: PrivateInfrastructure) => record.reference_year === 2024));
  });

  it("filters every region while excluding the national total", async () => {
    const regions = await loadRegions();
    for (const region of regions) {
      const response = await app.inject(`${url}?region_code=${region.code}`);
      assert.equal(response.statusCode, 200);
      const body = response.json();
      assert.equal(body.meta.total, 1);
      assert.equal(body.data[0].region_code, region.code);
      assert.equal(body.data[0].geographic_level, "region");
    }
    const casa = (await app.inject(`${url}?region_code=casablanca-settat`)).json().data[0];
    assert.equal(casa.clinics, 142);
    assert.equal(casa.dental_practices, 2395);
    assert.equal(casa.pharmacies, 2720);
    assert.equal(casa.analysis_laboratories, 260);
  });

  it("keeps unavailable regional breakdowns null and reconciles published totals", async () => {
    const body = (await app.inject(url)).json();
    const national = body.data.find((record: PrivateInfrastructure) => record.geographic_level === "national") as PrivateInfrastructure;
    const regional = body.data.filter((record: PrivateInfrastructure) => record.geographic_level === "region") as PrivateInfrastructure[];
    assert.equal(new Set(regional.map((record) => record.region_code)).size, 12);
    for (const record of regional) {
      for (const field of ["medical_practices", "radiology_practices", "hemodialysis_centres", "physiotherapy_centres", "infirmaries"] as const) {
        assert.equal(record[field], null, field);
      }
    }
    for (const field of ["clinics", "dental_practices", "pharmacies", "analysis_laboratories"] as const) {
      assert.equal(regional.reduce((sum, record) => sum + record[field]!, 0), national[field], field);
    }
  });

  it("rejects invalid geographic filters with consistent validation errors", async () => {
    for (const value of ["unknown", "", "01", "CASABLANCA-SETTAT"]) {
      const response = await app.inject(`${url}?region_code=${value}`);
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.equal(typeof response.json().error.request_id, "string");
    }
  });

  it("documents aggregate scope, null counts, source year and region filtering", async () => {
    const route = (await app.inject("/openapi.json")).json().paths[url].get;
    assert.equal(route.parameters.length, 1);
    assert.equal(route.parameters[0].name, "region_code");
    assert.equal(route.parameters[0].schema.enum.length, 12);
    assert.ok(route.description.includes("2024"));
    assert.ok(route.responses["400"]);
    const record = route.responses["200"].content["application/json"].schema.properties.data.items;
    assert.deepEqual(record.properties.geographic_level.enum, ["national", "region"]);
    assert.ok(record.properties.medical_practices.anyOf.some((schema: { type: string }) => schema.type === "null"));
    assert.ok(record.properties.reference_year.description.includes("not the publication"));
  });
});

describe("health/private-infrastructure data", () => {
  it("loads immutable aggregates and rejects an absent parent region", async () => {
    assert.ok(Object.isFrozen(records));
    assert.ok(records.every((record) => Object.isFrozen(record)));
    const regions = await loadRegions();
    await assert.rejects(loadPrivateInfrastructure(regions.slice(1)), /Invalid private infrastructure region/);
  });

  it("rejects missing, negative or non-integral counts and malformed aggregate scopes", async () => {
    const regions = await loadRegions();
    const national = records.find((record) => record.geographic_level === "national")!;
    const regional = records.find((record) => record.geographic_level === "region")!;
    for (const [data, error] of [
      [[], /must contain records/],
      [[{ ...national, clinics: -1 }], /Invalid private infrastructure record/],
      [[{ ...national, clinics: 1.5 }], /Invalid private infrastructure record/],
      [[{ ...national, clinics: undefined }], /Invalid private infrastructure record/],
      [[{ ...national, reference_year: null }], /Invalid private infrastructure record/],
      [[{ ...national, geographic_level: ["national"] }], /Invalid private infrastructure record/],
      [[{ ...national, region_code: regional.region_code }], /Invalid national private infrastructure record/],
      [[{ ...national, clinics: null }], /Invalid national private infrastructure record/],
      [[{ ...regional, region_code: null }], /Invalid private infrastructure region/],
      [[regional, regional], /Duplicate private infrastructure record/],
    ] as const) {
      const mockedRead = mock.method(fs, "readFile", async () => JSON.stringify(data));
      syncBuiltinESMExports();
      try {
        await assert.rejects(loadPrivateInfrastructure(regions), error);
      } finally {
        mockedRead.mock.restore();
        syncBuiltinESMExports();
      }
    }
  });
});
