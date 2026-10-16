import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Ajv from "ajv";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

const wideCodePaths = [
  "/api/v1/provinces/{code}",
  "/api/v1/prefectures-of-arrondissements/{code}",
  "/api/v1/communes/{code}",
  "/api/v1/arrondissements/{code}",
  "/api/v1/regions/{code}/subdivisions",
  "/api/v1/population/subdivisions/{code}",
  "/api/v1/population/communes/{code}",
];
const geographyDetails = [
  "/api/v1/regions/{code}",
  "/api/v1/provinces/{code}",
  "/api/v1/prefectures-of-arrondissements/{code}",
  "/api/v1/communes/{code}",
  "/api/v1/arrondissements/{code}",
];

interface PathParameter {
  in: string;
  schema: { maxLength?: number };
}

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Published path parameter contracts", () => {
  it("keeps every documented path length within the default router's 200-character limit", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const widerThan100 = [];
    for (const [path, item] of Object.entries(spec.paths)) {
      const operation = (item as { get: { parameters?: PathParameter[] } }).get;
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in !== "path" || parameter.schema.maxLength === undefined) continue;
        assert.ok(parameter.schema.maxLength <= 200, `${path}: declared maxLength exceeds the router limit`);
        if (parameter.schema.maxLength > 100) widerThan100.push(path);
      }
    }
    assert.deepEqual(widerThan100.sort(), [...wideCodePaths, "/api/v1/museums/{id}", "/api/v1/ports/{name}"].sort());
  });

  for (const path of wideCodePaths) {
    it(`${path} accepts its 180-character code boundary and validates the next character`, async () => {
      const allowed = await app.inject(path.replace("{code}", "a".repeat(180)));
      assert.equal(allowed.statusCode, 404, "A valid code absent from the snapshot must reach the resource lookup");
      assert.equal(allowed.json().error.code, "RESOURCE_NOT_FOUND");

      const invalid = await app.inject(path.replace("{code}", "a".repeat(181)));
      assert.equal(invalid.statusCode, 400, "The route schema must reject a code beyond its own maximum");
      assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
    });
  }

  it("accepts the museum ID's 200-character boundary and validates its required prefix", async () => {
    const missing = await app.inject(`/api/v1/museums/fnm-${"a".repeat(196)}`);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");

    const malformed = await app.inject(`/api/v1/museums/${"a".repeat(200)}`);
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, "VALIDATION_ERROR");
  });

  it("accepts the port name's 200-character boundary and validates its normalized minimum", async () => {
    const missing = await app.inject(`/api/v1/ports/${"a".repeat(200)}`);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");

    const malformed = await app.inject(`/api/v1/ports/${"%20".repeat(200)}`);
    assert.equal(malformed.statusCode, 400);
    assert.equal(malformed.json().error.code, "VALIDATION_ERROR");
  });

  it("documents the actual 400 validation envelope on all five geography detail routes", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const ajv = new Ajv({ strict: false, allErrors: true });
    for (const path of geographyDetails) {
      const responseSchema = spec.paths[path].get.responses["400"]?.content?.["application/json"]?.schema;
      assert.ok(responseSchema, `${path}: HTTP 400 must be documented`);
      const validate = ajv.compile(responseSchema);
      const response = await app.inject(path.replace("{code}", "INVALID_CODE"));
      assert.equal(response.statusCode, 400);
      const error = response.json();
      assert.equal(error.error.code, "VALIDATION_ERROR");
      assert.ok(validate(error), `${path}: ${JSON.stringify(validate.errors)}`);
    }
  });
});
