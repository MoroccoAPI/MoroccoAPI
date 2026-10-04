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

describe("home", () => {
  it("serves the homepage and its logo without exposing them in OpenAPI", async () => {
    const page = await app.inject({ method: "GET", url: "/" });
    assert.equal(page.statusCode, 200);
    assert.match(page.headers["content-type"] ?? "", /^text\/html/);
    assert.match(page.body, /href="\/docs"/);

    const logo = await app.inject({
      method: "GET",
      url: "/assets/moroccoapi-logo.png",
    });
    assert.equal(logo.statusCode, 200);
    assert.equal(logo.headers["content-type"], "image/png");
    assert.equal(logo.rawPayload.subarray(1, 4).toString(), "PNG");

    const spec = (await app.inject("/openapi.json")).json();
    assert.equal(spec.paths["/"], undefined);
    assert.equal(spec.paths["/assets/moroccoapi-logo.png"], undefined);
  });
});
