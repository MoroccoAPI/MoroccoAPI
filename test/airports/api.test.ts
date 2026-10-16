import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";
import type { Airport } from "../../src/airports/types.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Airports API", () => {
  it("returns the complete MA snapshot with public-domain provenance and explicit scope", async () => {
    const response = await app.inject("/api/v1/airports");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().meta.pagination, {
      limit: 100, offset: 0, count: 45, has_more: false, next_offset: null,
    });
    const { data, meta } = await collectAllPages(app, "/api/v1/airports");
    assert.equal(data.length, 45);
    assert.equal(meta.total, 45);
    assert.equal(meta.license, "Public-Domain");
    assert.equal(meta.snapshot_date, "2026-10-14");
    assert.equal(new Set(data.map((row: Airport) => row.id)).size, 45);
    assert.match(meta.scope, /iso_country=MA/);
    assert.ok(meta.limitations.some((text: string) => text.includes("Dakhla and Laayoune")));
    for (const row of data) {
      assert.equal(row.iso_country, "MA");
      assert.deepEqual(Object.keys(row).sort(), ["id", "ident", "icao_code", "iata_code", "name", "type", "municipality", "iso_country", "iso_region", "location", "scheduled_service"].sort());
    }
  });

  it("searches names, municipalities, IATA and ICAO without case or accent distinctions", async () => {
    for (const q of ["mohammed", "casablanca", "cmn", "gmmn"]) {
      const response = await app.inject(`/api/v1/airports?q=${q}`);
      assert.equal(response.statusCode, 200);
      assert.ok(response.json().data.some((row: Airport) => row.icao_code === "GMMN"), q);
    }
    const fes = await app.inject("/api/v1/airports?q=F%C3%A8s");
    assert.ok(fes.json().data.some((row: Airport) => row.icao_code === "GMFF"));
  });

  it("combines city, type, scheduled-service and text filters", async () => {
    const response = await app.inject("/api/v1/airports?city=CASABLANCA&type=large_airport&scheduled_service=true&q=cmn");
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 1);
    assert.equal(response.json().data[0].icao_code, "GMMN");
    const incompatible = await app.inject("/api/v1/airports?city=Casablanca&type=heliport&scheduled_service=true");
    assert.equal(incompatible.statusCode, 200);
    assert.deepEqual(incompatible.json().data, []);
    assert.equal(incompatible.json().meta.total, 0);
    const empty = await app.inject("/api/v1/airports?city=not-a-source-city");
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().meta.total, 0);
  });

  it("retains closed sites, heliports and source no-service flags without claiming live availability", async () => {
    const closed = await app.inject("/api/v1/airports?type=closed");
    assert.equal(closed.json().meta.total, 7);
    const heliports = await app.inject("/api/v1/airports?type=heliport&scheduled_service=false");
    assert.equal(heliports.json().meta.total, 2);
    assert.ok(heliports.json().data.every((row: Airport) => row.icao_code === null));
  });

  it("retrieves an airport by case-insensitive explicit ICAO code", async () => {
    for (const code of ["GMMN", "gmmn"]) {
      const response = await app.inject(`/api/v1/airports/${code}`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.iata_code, "CMN");
      assert.equal(response.json().meta.total, 1);
    }
    const source = await app.inject("/api/v1/airports/GMAG");
    assert.equal(source.statusCode, 200);
    assert.equal(source.json().data.ident, "MA-GLN");
  });

  it("does not treat source ident as ICAO when it differs or the explicit code is absent", async () => {
    for (const code of ["GMMY", "GMMT"]) {
      const response = await app.inject(`/api/v1/airports/${code}`);
      assert.equal(response.statusCode, 404, code);
      assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
    }
    const kenitra = await app.inject("/api/v1/airports/GMMP");
    assert.equal(kenitra.statusCode, 200);
    assert.equal(kenitra.json().data.ident, "GMMY");
  });

  it("returns the standard 404 for unknown or out-of-scope ICAO codes", async () => {
    for (const code of ["ZZZZ", "GMMH", "GMML"]) {
      const response = await app.inject(`/api/v1/airports/${code}`);
      assert.equal(response.statusCode, 404);
      assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
      assert.equal(typeof response.json().error.request_id, "string");
    }
  });

  it("rejects malformed ICAO, short/blank searches, invalid types and invalid booleans", async () => {
    for (const path of [
      "/api/v1/airports/CMN", "/api/v1/airports/MA-GLN", "/api/v1/airports/GMM1",
      "/api/v1/airports?q=a", "/api/v1/airports?q=%20%20", "/api/v1/airports?city=%20%20",
      "/api/v1/airports?q=%D9%8E%D9%8E", `/api/v1/airports?q=${"a".repeat(101)}`,
      "/api/v1/airports?type=closed_airport", "/api/v1/airports?scheduled_service=yes",
    ]) {
      const response = await app.inject(path);
      assert.equal(response.statusCode, 400, path);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });

  it("documents list filters and explicit ICAO details in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const list = spec.paths["/api/v1/airports"].get;
    assert.deepEqual(list.tags, ["Airports"]);
    assert.deepEqual(list.parameters.map((p: { name: string }) => p.name).sort(), ["city", "limit", "offset", "q", "scheduled_service", "type"]);
    const detail = spec.paths["/api/v1/airports/{icao}"].get;
    assert.ok(detail.responses["200"] && detail.responses["400"] && detail.responses["404"]);
  });
});
