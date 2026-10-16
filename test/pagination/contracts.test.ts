import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import SwaggerParser from "@apidevtools/swagger-parser";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadEducationSchools } from "../../src/education/data/schools.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

const collectionPaths = [
  "/api/v1/regions", "/api/v1/provinces", "/api/v1/prefectures-of-arrondissements",
  "/api/v1/communes", "/api/v1/arrondissements", "/api/v1/regions/{code}/subdivisions",
  "/api/v1/locations/search", "/api/v1/population/regions", "/api/v1/population/historical",
  "/api/v1/population/subdivisions", "/api/v1/population/communes",
  "/api/v1/health/private-infrastructure", "/api/v1/health/primary-care-facilities", "/api/v1/health/hospitals",
  "/api/v1/telecom/numbering-ranges", "/api/v1/telecom/area-codes",
  "/api/v1/education/etablissement-prives", "/api/v1/education/etablissement-publics-qualifiant",
  "/api/v1/education/etablissements-prives-cpge", "/api/v1/education/etablissements-publics-primaire",
  "/api/v1/education/etablissements-publics-collegial", "/api/v1/education/etablissements-publics-bts",
  "/api/v1/education/etablissements-publics-cpge", "/api/v1/education/universites-publiques",
  "/api/v1/airports", "/api/v1/museums", "/api/v1/postal-codes",
  "/api/v1/postal-codes/cities", "/api/v1/postal-codes/{code}",
  "/api/v1/ports", "/api/v1/lighthouses",
  "/api/v1/dams", "/api/v1/dams/{id}/levels",
  "/api/v1/world-bank/indicators", "/api/v1/world-bank/indicators/topics",
];

describe("Pagination contracts", () => {
  it("publishes mandatory bounded pagination and defaults on every supported collection", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    await SwaggerParser.validate(spec, { resolve: { external: false } });
    const publishedCollections = Object.keys(spec.paths).filter((path) =>
      path !== "/api/v1/holidays/{year}" &&
      spec.paths[path].get.responses["200"]?.content?.["application/json"]?.schema.properties?.data?.type === "array");
    assert.deepEqual(publishedCollections.sort(), [...collectionPaths].sort(), "Every collection needs pagination contract coverage");
    for (const path of collectionPaths) {
      const operation = spec.paths[path].get;
      const limit = operation.parameters.find((parameter: { name: string }) => parameter.name === "limit");
      const offset = operation.parameters.find((parameter: { name: string }) => parameter.name === "offset");
      assert.equal(limit.required, false, path);
      assert.equal(limit.schema.minimum, 1, path);
      assert.equal(limit.schema.maximum, 500, path);
      assert.equal(offset.required, false, path);
      assert.equal(offset.schema.minimum, 0, path);
      assert.equal(offset.schema.maximum, 2_147_483_647, path);
      assert.equal(limit.schema.default, 100, path);
      assert.equal(offset.schema.default, 0, path);
      const meta = operation.responses["200"].content["application/json"].schema.properties.meta;
      assert.ok(meta.properties.pagination, path);
      assert.ok(meta.required.includes("pagination"), path);
    }
    assert.ok(!spec.paths["/api/v1/holidays/{year}"].get.parameters.some((parameter: { name: string }) => parameter.name === "limit"));
  });

  it("rejects invalid, repeated and unsafe pagination values consistently", async () => {
    for (const query of [
      "limit=0", "limit=-1", "limit=501", "limit=1.5", "limit=abc", "limit=", "limit=1&limit=2",
      "offset=-1", "offset=0.5", "offset=abc", "offset=", "offset=2147483648", "offset=9007199254740992", "offset=1&offset=2",
    ]) {
      const response = await app.inject(`/api/v1/communes?${query}`);
      assert.equal(response.statusCode, 400, query);
      const error = response.json().error;
      assert.equal(error.code, "VALIDATION_ERROR", query);
      assert.equal(typeof error.request_id, "string", query);
    }
  });

  it("rejects non-finite pagination values on every paginated collection with validation errors", async () => {
    for (const path of collectionPaths) {
      const resolved = path.replace("{code}", path.startsWith("/api/v1/postal-codes/") ? "10000" : "casablanca-settat").replace("{id}", "yacoub-el-mansour");
      for (const parameter of ["limit", "offset"]) {
        for (const value of ["Infinity", "-Infinity", "+Infinity", "1e309", "-1e309"]) {
          const url = new URL(resolved, "http://localhost");
          if (path === "/api/v1/locations/search" || path === "/api/v1/postal-codes") url.searchParams.set("q", "rabat");
          url.searchParams.set(parameter, value);
          const requestUrl = url.pathname + url.search;
          const response = await app.inject(requestUrl);
          assert.equal(response.statusCode, 400, requestUrl);
          assert.match(String(response.headers["content-type"]), /^application\/json(?:;|$)/);
          const body = response.json();
          assert.deepEqual(Object.keys(body), ["error"], requestUrl);
          assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "request_id"], requestUrl);
          assert.equal(body.error.code, "VALIDATION_ERROR", requestUrl);
          assert.equal(typeof body.error.message, "string", requestUrl);
          assert.ok(body.error.message.length > 0, requestUrl);
          assert.equal(typeof body.error.request_id, "string", requestUrl);
          assert.ok(body.error.request_id.length > 0, requestUrl);
        }
      }
    }
  });

  it("retains finite numeric coercion and the largest supported offset", async () => {
    const numericNotation = await app.inject("/api/v1/communes?limit=1e2&offset=1.0");
    const ordinaryNotation = await app.inject("/api/v1/communes?limit=100&offset=1");
    assert.equal(numericNotation.statusCode, 200);
    assert.equal(ordinaryNotation.statusCode, 200);
    assert.deepEqual(numericNotation.json(), ordinaryNotation.json());

    const finalPage = await app.inject("/api/v1/communes?limit=500&offset=2147483647");
    assert.equal(finalPage.statusCode, 200);
    assert.deepEqual(finalPage.json().data, []);
    assert.equal(finalPage.json().meta.total, 1503);
    assert.deepEqual(finalPage.json().meta.pagination, {
      limit: 500, offset: 2_147_483_647, count: 0, has_more: false, next_offset: null,
    });
  });

  it("bounds the largest collection by default without an unpaginated query escape", async () => {
    const path = "/api/v1/education/etablissements-publics-primaire";
    const defaultPage = await app.inject(path);
    const page = await app.inject(`${path}?limit=100&offset=0`);
    assert.equal(defaultPage.statusCode, 200);
    assert.equal(page.statusCode, 200);
    const full = (await loadEducationSchools()).filter((school) => school.category === "public-primary");
    const bounded = page.json();
    assert.equal(full.length, 7_963);
    assert.deepEqual(defaultPage.json(), bounded);
    assert.equal(bounded.data.length, 100);
    assert.equal(bounded.meta.total, full.length);
    assert.deepEqual(bounded.data, full.slice(0, 100));
    assert.deepEqual(bounded.meta.pagination, { limit: 100, offset: 0, count: 100, has_more: true, next_offset: 100 });
    assert.ok(Buffer.byteLength(defaultPage.body) < Buffer.byteLength(JSON.stringify(full)) / 20);
    for (const query of ["limit=0", "limit=7963", "limit=all", "limit=false"]) {
      assert.equal((await app.inject(`${path}?${query}`)).statusCode, 400, query);
    }
  });
});
