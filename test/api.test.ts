import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("MoroccoAPI", () => {
  it("reports service health", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.service, "MoroccoAPI");
    assert.match(body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof body.meta.request_id, "string");
  });

  it("returns exactly 12 regions with unique MoroccoAPI codes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/regions" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 12);
    assert.equal(body.meta.total, 12);
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.equal(body.meta.sources.length, 2);

    const codes = body.data.map((region: { code: string }) => region.code);
    assert.equal(new Set(codes).size, 12);
  });

  it("returns one region by code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/regions/casablanca-settat",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.name.ar, "الدار البيضاء - سطات");
    assert.equal(body.data.name.fr, "Casablanca-Settat");
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when a region is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/regions/unknown-region",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("searches names without requiring French accents", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=kenitra",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].code, "rabat-sale-kenitra");
  });

  it("searches Arabic names", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=%D8%A7%D9%84%D8%B4%D8%B1%D9%82",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].code, "oriental");
  });

  it("rejects invalid search queries", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=a",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");

    const whitespaceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=%20%20",
    });
    assert.equal(whitespaceResponse.statusCode, 400);
    assert.equal(whitespaceResponse.json().error.code, "VALIDATION_ERROR");
  });

  it("publishes an OpenAPI document for the public routes", async () => {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.info.title, "MoroccoAPI");
    assert.ok(body.paths["/api/v1/regions"]);
    assert.ok(body.paths["/api/v1/locations/search"]);
  });

  it("returns a consistent error for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "ROUTE_NOT_FOUND");
  });
});
