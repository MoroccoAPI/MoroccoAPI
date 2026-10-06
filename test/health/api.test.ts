import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import { loadHospitals } from "../../src/health/data/hospitals.js";
import type { Hospital } from "../../src/health/types.js";

let app: FastifyInstance;
let hospitals: readonly Hospital[];

before(async () => {
  const regions = await loadRegions();
  const geography = await loadGeography(regions);
  hospitals = await loadHospitals(regions, geography);
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("health/hospitals", () => {
  it("returns the complete directory with the same metadata fields as Geography", async () => {
    const response = await app.inject("/api/v1/health/hospitals");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, hospitals.length);
    assert.equal(body.meta.total, body.data.length);
    assert.equal(body.meta.license, "ODbL-1.0");
    const geographyMeta = (await app.inject("/api/v1/regions")).json().meta;
    assert.deepEqual(Object.keys(body.meta).sort(), Object.keys(geographyMeta).sort());
    for (const source of body.meta.sources) {
      assert.equal(typeof source.dataset, "string");
      assert.deepEqual(Object.keys(source).sort(), Object.keys(geographyMeta.sources[0]).sort());
    }
  });

  it("returns unique records without preparation details", async () => {
    const body = (await app.inject("/api/v1/health/hospitals")).json();
    const ids = body.data.map((hospital: Hospital) => hospital.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const hospital of body.data) {
      for (const field of ["source_locality", "osm_refs", "sources", "verification_sources"]) {
        assert.ok(!(field in hospital), field);
      }
      if (hospital.location) {
        assert.deepEqual(Object.keys(hospital.location).sort(), ["latitude", "longitude"]);
      }
    }
  });

  it("combines region, province and official category filters", async () => {
    const response = await app.inject("/api/v1/health/hospitals?region_code=fes-meknes&province_code=fes&category=HIR");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data.length > 0);
    for (const record of body.data as Hospital[]) {
      assert.equal(record.region_code, "fes-meknes");
      assert.equal(record.province_code, "fes");
      assert.equal(record.category, "HIR");
    }
    const incompatible = await app.inject("/api/v1/health/hospitals?region_code=fes-meknes&province_code=kenitra");
    assert.equal(incompatible.statusCode, 200);
    assert.equal(incompatible.json().meta.total, 0);
    assert.deepEqual(incompatible.json().data, []);
  });

  it("searches source names and aliases without requiring accents or case", async () => {
    const response = await app.inject(`/api/v1/health/hospitals?province_code=larache&q=${encodeURIComponent("MÉRIEM")}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].name, "Lalla Meriem");
    assert.ok(response.json().data[0].aliases.includes("Hôpital Princesse Lalla Meriem"));
  });

  it("uses the shared normalization for Arabic hospital aliases", async () => {
    const response = await app.inject(`/api/v1/health/hospitals?q=${encodeURIComponent("عـيَاشي")}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.length, 1);
    assert.equal(response.json().data[0].name, "El Ayachi");
  });

  it("returns detail records with their reference years", async () => {
    const id = "hospital-05cee4b635a1b6c1";
    const response = await app.inject(`/api/v1/health/hospitals/${id}`);
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.id, id);
    assert.equal(body.data.name, "Tiflet");
    assert.equal(body.data.reference_year, 2024);
    assert.equal(body.data.province_code, "khemisset");
    assert.ok(body.data.location);
    assert.equal(body.meta.total, 1);
  });

  it("keeps unknown locations and unverified classifications null", async () => {
    const withoutLocation = hospitals.find((hospital) => hospital.location === null);
    assert.ok(withoutLocation);
    const response = await app.inject(`/api/v1/health/hospitals/${withoutLocation.id}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.location, null);

    const addition = await app.inject("/api/v1/health/hospitals/hospital-osm-way-789296397");
    assert.equal(addition.statusCode, 200);
    for (const field of ["category", "category_label", "ownership", "reference_year"]) {
      assert.equal(addition.json().data[field], null, field);
    }
  });

  it("preserves parent geography and immutable records", async () => {
    const regionCodes = (await loadRegions()).map((region) => region.code);
    const provinces = JSON.parse(await readFile(new URL("../../data/geography/administrative-provinces.json", import.meta.url), "utf8")) as { code: string }[];
    const provinceCodes = provinces.map((province) => province.code);
    assert.equal(new Set(hospitals.map((hospital) => hospital.region_code)).size, 12);
    for (const hospital of hospitals) {
      assert.ok(regionCodes.includes(hospital.region_code));
      assert.ok(provinceCodes.includes(hospital.province_code));
      assert.ok(hospital.commune_code);
      assert.ok(Object.isFrozen(hospital));
    }
  });

  it("returns consistent validation errors and missing-resource responses", async () => {
    for (const query of ["region_code=unknown", "province_code=unknown", "category=invalid", "q=%20%20"]) {
      const response = await app.inject(`/api/v1/health/hospitals?${query}`);
      assert.equal(response.statusCode, 400, query);
      assert.equal(response.json().error.code, "VALIDATION_ERROR", query);
      assert.equal(typeof response.json().error.request_id, "string");
    }
    const missing = await app.inject("/api/v1/health/hospitals/hospital-does-not-exist");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("documents both routes and filters in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const collection = spec.paths["/api/v1/health/hospitals"].get;
    const detail = spec.paths["/api/v1/health/hospitals/{id}"].get;
    assert.ok(collection.parameters.some((parameter: { name: string }) => parameter.name === "region_code"));
    assert.ok(collection.parameters.some((parameter: { name: string }) => parameter.name === "province_code"));
    assert.ok(detail.responses["404"]);
    assert.ok(collection.responses["200"].content["application/json"].schema.properties.data.items.properties.location);
  });
});

describe("health/data", () => {
  it("rejects hospital records whose parent region is absent", async () => {
    const regions = await loadRegions();
    const geography = await loadGeography(regions);
    await assert.rejects(
      loadHospitals(regions.filter((region) => region.code !== "rabat-sale-kenitra"), geography),
      /Invalid hospital province\/region relationship/,
    );
  });
});
