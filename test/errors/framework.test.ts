import assert from "node:assert/strict";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

interface ErrorResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

interface ErrorBody {
  error: { code: string; message: string; request_id: string };
}

const longParameter = "a".repeat(201);
const routerErrors = [
  ["/api/v1/regions/%FF", 400],
  ["/api/v1/regions/%zz", 400],
  ["/api/v1/regions/%E0%A4", 400],
  [`/api/v1/regions/${longParameter}`, 414],
] as const;

function assertEnvelope(response: ErrorResponse, status: number, code: string): ErrorBody {
  assert.equal(response.statusCode, status);
  assert.match(String(response.headers["content-type"]), /^application\/json(?:;|$)/i);
  const body: ErrorBody = JSON.parse(response.body);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.ok(body.error && typeof body.error === "object" && !Array.isArray(body.error));
  assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "request_id"]);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
  assert.equal(typeof body.error.request_id, "string");
  assert.ok(body.error.request_id.length > 0);
  return body;
}

async function getOverHttp(origin: string, path: string, method: "GET" | "HEAD" = "GET"): Promise<ErrorResponse> {
  const address = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: address.hostname,
      port: Number(address.port),
      method,
      path,
      agent: false,
    }, (response) => {
      response.setEncoding("utf8");
      let body = "";
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("error", reject);
      response.on("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body,
      }));
    });
    request.setTimeout(5_000, () => request.destroy(new Error("Local HTTP request timed out")));
    request.on("error", reject);
    request.end();
  });
}

let app: FastifyInstance;
before(async () => {
  app = await buildApp();
  app.get("/__tests__/unexpected-error", { schema: { hide: true } }, async () => {
    throw new Error("private-internal-error-detail");
  });
  app.get("/__tests__/client-error", { schema: { hide: true } }, async () => {
    throw Object.assign(new Error("Client request rejected"), { statusCode: 422 });
  });
  await app.ready();
});
after(async () => { await app.close(); });

describe("Framework error envelopes", () => {
  it("returns the documented JSON envelope for bad URL encodings and oversized parameters", async () => {
    const requestIds = [];
    for (const [url, status] of routerErrors) {
      const response = await app.inject(url);
      const body = assertEnvelope(response, status, "REQUEST_ERROR");
      assert.equal(body.error.message, status === 400
        ? "The requested URL is malformed"
        : "A URL parameter exceeds the maximum length");
      requestIds.push(body.error.request_id);
    }
    assert.equal(new Set(requestIds).size, routerErrors.length);
  });

  it("formats real HTTP router errors on a local ephemeral port", async () => {
    const listeningApp = await buildApp();
    try {
      const origin = await listeningApp.listen({ host: "127.0.0.1", port: 0 });
      const ids = [];
      for (const [path, status] of [routerErrors[0], routerErrors[3]]) {
        const body = assertEnvelope(await getOverHttp(origin, path), status, "REQUEST_ERROR");
        ids.push(body.error.request_id);
      }
      assert.equal(new Set(ids).size, ids.length);
    } finally {
      await listeningApp.close();
    }
  });

  it("uses the configured request-ID generator for framework and ordinary errors", async () => {
    let sequence = 0;
    const configuredApp = await buildApp({ genReqId: () => `custom-error-${++sequence}` });
    try {
      await configuredApp.ready();
      const cases = [
        [routerErrors[0][0], 400, "REQUEST_ERROR"],
        [routerErrors[3][0], 414, "REQUEST_ERROR"],
        ["/api/v1/regions/a", 400, "VALIDATION_ERROR"],
      ] as const;
      for (const [index, [url, status, code]] of cases.entries()) {
        const body = assertEnvelope(await configuredApp.inject(url), status, code);
        assert.equal(body.error.request_id, `custom-error-${index + 1}`);
      }
    } finally {
      await configuredApp.close();
    }
  });

  it("preserves an explicitly configured router parameter-length boundary", async () => {
    for (const [options, maximum] of [
      [{ routerOptions: { maxParamLength: 12 } }, 12],
      [{ maxParamLength: 12 }, 12],
      [{ maxParamLength: 12, routerOptions: { maxParamLength: 15 } }, 15],
    ] as const) {
      const configuredApp = await buildApp(options);
      try {
        await configuredApp.ready();
        const allowed = assertEnvelope(await configuredApp.inject(`/api/v1/regions/${"a".repeat(maximum)}`), 404, "RESOURCE_NOT_FOUND");
        assert.ok(allowed.error.message.includes("a".repeat(maximum)));
        assertEnvelope(await configuredApp.inject(`/api/v1/regions/${"a".repeat(maximum + 1)}`), 414, "REQUEST_ERROR");
        assert.equal((await configuredApp.inject("/api/v1/regions/oriental")).statusCode, 200);
      } finally {
        await configuredApp.close();
      }
    }
  });

  it("does not reflect credential query values in framework messages or request logs", async () => {
    const logs: string[] = [];
    const loggedApp = await buildApp({ logger: {
      level: "info",
      stream: { write: (line: string) => { logs.push(line); } },
    } });
    const secrets = ["framework-test-token-value", "framework-test-key-value", "framework-test-authorization", "framework-test-cookie"];
    try {
      await loggedApp.ready();
      const query = new URLSearchParams({ token: secrets[0]!, key: secrets[1]! });
      for (const [path, status] of [routerErrors[0], routerErrors[3]]) {
        const response = await loggedApp.inject({
          url: `${path}?${query}`,
          headers: { authorization: `Bearer ${secrets[2]}`, cookie: `session=${secrets[3]}` },
        });
        const body = assertEnvelope(response, status, "REQUEST_ERROR");
        assert.ok(!body.error.message.includes("/api/v1/regions/"));
        for (const value of secrets) assert.ok(!response.body.includes(value));
      }
      assert.equal((await loggedApp.inject("/api/v1/status")).statusCode, 200);
    } finally {
      await loggedApp.close();
    }
    const output = logs.join("");
    assert.ok(output.includes("/api/v1/status"), "ordinary request logging remains active");
    for (const value of secrets) assert.ok(!output.includes(value), "credential values must not appear in logs");
  });

  it("retains ordinary validation, missing-route, client-error and masked internal-error behavior", async () => {
    assertEnvelope(await app.inject("/api/v1/regions/a"), 400, "VALIDATION_ERROR");
    assertEnvelope(await app.inject("/does-not-exist"), 404, "ROUTE_NOT_FOUND");
    const client = assertEnvelope(await app.inject("/__tests__/client-error"), 422, "REQUEST_ERROR");
    assert.equal(client.error.message, "Client request rejected");
    const internal = assertEnvelope(await app.inject("/__tests__/unexpected-error"), 500, "INTERNAL_ERROR");
    assert.equal(internal.error.message, "An internal error occurred");
    assert.ok(!JSON.stringify(internal).includes("private-internal-error-detail"));
  });

  it("masks actual framework failures from an asynchronous routing constraint", async () => {
    const failedApp = await buildApp({ routerOptions: { constraints: {
      failure: {
        name: "failure",
        storage() {
          const values = new Map();
          return { get: (key: string) => values.get(key) ?? null, set: (key: string, value: unknown) => { values.set(key, value); } };
        },
        deriveConstraint(_request, _context, done) { done(new Error("private-routing-constraint-detail")); },
        validate() { return true; },
      },
    } } });
    try {
      failedApp.get("/__tests__/constraint-error", {
        constraints: { failure: "test" }, schema: { hide: true },
      }, async () => ({ unexpected: "handler must not run" }));
      await failedApp.ready();
      const response = await failedApp.inject("/__tests__/constraint-error");
      const body = assertEnvelope(response, 500, "INTERNAL_ERROR");
      assert.equal(body.error.message, "An internal error occurred");
      assert.ok(!response.body.includes("private-routing-constraint-detail"));
    } finally {
      await failedApp.close();
    }
  });

  it("retains an explicitly provided framework error callback", async () => {
    const configuredApp = await buildApp({
      frameworkErrors(error, request, reply) {
        return reply.code(409).send({ custom: true, framework_code: error.code, request_id: request.id });
      },
    });
    try {
      await configuredApp.ready();
      const response = await configuredApp.inject(routerErrors[0][0]);
      assert.equal(response.statusCode, 409);
      assert.deepEqual(response.json(), {
        custom: true, framework_code: "FST_ERR_BAD_URL", request_id: response.json().request_id,
      });
      assert.equal(typeof response.json().request_id, "string");
      assert.ok(response.json().request_id.length > 0);
    } finally {
      await configuredApp.close();
    }
  });

  it("returns the same framework status and JSON media type for HEAD without a response body", async () => {
    const listeningApp = await buildApp();
    try {
      const origin = await listeningApp.listen({ host: "127.0.0.1", port: 0 });
      for (const [url, status] of [routerErrors[0], routerErrors[3]]) {
        const response = await getOverHttp(origin, url, "HEAD");
        assert.equal(response.statusCode, status);
        assert.match(String(response.headers["content-type"]), /^application\/json(?:;|$)/i);
        assert.equal(response.body, "");
      }
    } finally {
      await listeningApp.close();
    }
  });
});
