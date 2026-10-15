import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

let app: FastifyInstance;
before(async () => {
  app = await buildApp();
  app.get("/__tests__/cors-error", { schema: { hide: true } }, async () => {
    throw new Error("private-cors-test-detail");
  });
  await app.ready();
});
after(async () => { await app.close(); });

const origin = "https://client.example";

describe("Public browser access", () => {
  it("allows any origin to read successful responses without credentialed CORS", async () => {
    for (const requestOrigin of [origin, "https://another.example", "null"]) {
      const response = await app.inject({ url: "/api/v1/regions", headers: { origin: requestOrigin } });
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["access-control-allow-origin"], "*");
      assert.equal(response.headers["access-control-allow-credentials"], undefined);
      assert.equal(response.json().data.length, 12);
    }
  });

  it("exposes the revision header for browser diagnostics", async () => {
    const response = await app.inject({ url: "/api/v1/status", headers: { origin } });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-expose-headers"], "X-MoroccoAPI-Revision");
    assert.equal(response.json().data.status, "ok");
  });

  it("handles GET and HEAD preflights with the requested headers and an empty body", async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await app.inject({ method: "OPTIONS", url: "/api/v1/regions", headers: {
        origin,
        "access-control-request-method": method,
        "access-control-request-headers": "content-type,x-client-trace",
      } });
      assert.equal(response.statusCode, 204);
      assert.equal(response.body, "");
      assert.equal(response.headers["access-control-allow-origin"], "*");
      assert.equal(response.headers["access-control-allow-credentials"], undefined);
      const methods = String(response.headers["access-control-allow-methods"]).split(/,\s*/).sort();
      assert.deepEqual(methods, ["GET", "HEAD"]);
      assert.equal(response.headers["access-control-allow-headers"], "content-type,x-client-trace");
      assert.match(String(response.headers.vary), /Access-Control-Request-Headers/i);
    }
  });

  it("keeps ordinary and early router errors readable with the JSON error contract", async () => {
    for (const [url, status] of [
      ["/api/v1/regions/a", 400],
      ["/api/v1/regions?limit=Infinity", 400],
      ["/missing-cors-test-route", 404],
      ["/__tests__/cors-error", 500],
      ["/api/v1/regions/%FF", 400],
      [`/api/v1/regions/${"a".repeat(201)}`, 414],
    ] as const) {
      const response = await app.inject({ url, headers: { origin } });
      assert.equal(response.statusCode, status, url);
      assert.equal(response.headers["access-control-allow-origin"], "*", url);
      assert.equal(response.headers["access-control-allow-credentials"], undefined, url);
      assert.match(String(response.headers["content-type"]), /^application\/json(?:;|$)/i, url);
      const body = response.json();
      assert.deepEqual(Object.keys(body), ["error"], url);
      assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "request_id"], url);
      assert.equal(typeof body.error.request_id, "string", url);
      assert.ok(!response.body.includes("private-cors-test-detail"), url);
    }
  });

  it("returns JSON validation errors for malformed preflights", async () => {
    for (const headers of [{}, { origin }, { "access-control-request-method": "GET" }]) {
      const response = await app.inject({ method: "OPTIONS", url: "/api/v1/regions", headers });
      assert.equal(response.statusCode, 400);
      assert.equal(response.headers["access-control-allow-origin"], "*");
      assert.match(String(response.headers["content-type"]), /^application\/json(?:;|$)/i);
      assert.deepEqual(Object.keys(response.json()), ["error"]);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.equal(typeof response.json().error.request_id, "string");
    }
  });

  it("keeps the preflight route out of the published API contract", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    assert.ok(Object.values(spec.paths).every((operation) => !(operation as { options?: unknown }).options));
    assert.ok(!Object.keys(spec.paths).some((path) => path.includes("*")));
  });

  it("serves CORS headers and preflights over an actual HTTP connection", async () => {
    const listeningApp = await buildApp();
    try {
      const address = await listeningApp.listen({ host: "127.0.0.1", port: 0 });
      const response = await fetch(`${address}/api/v1/regions`, { headers: { origin } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("access-control-allow-origin"), "*");
      assert.equal((await response.json()).data.length, 12);
      const preflight = await fetch(`${address}/api/v1/regions`, { method: "OPTIONS", headers: {
        origin, "access-control-request-method": "GET", "access-control-request-headers": "content-type",
      } });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
      assert.equal(await preflight.text(), "");
      const invalid = await fetch(`${address}/api/v1/regions/%FF`, { headers: { origin } });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.headers.get("access-control-allow-origin"), "*");
      assert.equal((await invalid.json()).error.code, "REQUEST_ERROR");
    } finally {
      await listeningApp.close();
    }
  });
});
