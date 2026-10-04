import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("status", () => {
  it("reports service health", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.service, "MoroccoAPI");
    assert.equal(response.headers["x-moroccoapi-revision"], process.env.RENDER_GIT_COMMIT);
    assert.match(body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof body.meta.request_id, "string");
  });
});
