import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { examples } from "../../src/docs/content.js";

interface Parameter {
  in: string;
  name: string;
}

let app: FastifyInstance;
let paths: Record<string, { get: { parameters?: Parameter[] } }>;

before(async () => {
  app = await buildApp();
  await app.ready();
  paths = (await app.inject("/openapi.json")).json().paths;
});

after(async () => {
  await app.close();
});

/** A working URL for a documented path, filled from the documentation examples. */
function exampleUrl(path: string): string {
  const shortPath = path.slice("/api/v2".length);
  const values = examples[shortPath] ?? {};
  const url = new URL(path.replace(/\{(\w+)\}/g, (_, name: string) => {
    assert.ok(values[name], `${shortPath} needs an example for ${name}`);
    return encodeURIComponent(values[name]);
  }), "http://localhost");
  const queryNames = new Set(paths[path]!.get.parameters?.filter((item) => item.in === "query").map((item) => item.name));
  for (const [name, value] of Object.entries(values)) {
    if (queryNames.has(name)) url.searchParams.set(name, value);
  }
  return url.pathname + url.search;
}

const withQuery = (url: string, query: string) => `${url}${url.includes("?") ? "&" : "?"}${query}`;

describe("Query parameter contracts", () => {
  it("rejects unknown query parameters on every route that declares query parameters", async () => {
    const strict = Object.keys(paths).filter((path) =>
      paths[path]!.get.parameters?.some((parameter) => parameter.in === "query"));
    assert.ok(strict.length > 40);
    for (const path of strict) {
      const url = exampleUrl(path);
      assert.equal((await app.inject(url)).statusCode, 200, url);
      const response = await app.inject(withQuery(url, "regoin_code=souss-massa"));
      assert.equal(response.statusCode, 400, url);
      assert.deepEqual(response.json().error.code, "VALIDATION_ERROR", url);
      assert.equal(response.json().error.message, "Unknown query parameter 'regoin_code'", url);
    }
  });

  it("no longer returns unfiltered results for a misspelled filter, on v2 and v1", async () => {
    const filtered = await app.inject("/api/v2/health/hospitals?region_code=souss-massa");
    assert.equal(filtered.json().meta.total, 9);
    for (const version of ["v2", "v1"]) {
      const response = await app.inject(`/api/${version}/health/hospitals?regoin_code=souss-massa`);
      assert.equal(response.statusCode, 400, version);
      assert.equal(response.json().error.message, "Unknown query parameter 'regoin_code'", version);
    }
  });

  it("keeps the parameter-free routes and the documentation unchanged", async () => {
    assert.equal((await app.inject("/api/v2/status?source=test")).statusCode, 200);
    assert.equal((await app.inject("/api/v2/regions/rabat-sale-kenitra?source=test")).statusCode, 200);
    assert.equal((await app.inject("/docs?lang=en&source=test")).statusCode, 200);
  });
});

describe("Trailing slash contracts", () => {
  it("serves collections, resources and documentation with or without a trailing slash", async () => {
    for (const url of [
      "/api/v2/regions", "/api/v1/regions", "/api/v2/regions/rabat-sale-kenitra",
      "/api/v2/communes?limit=2", "/api/v2/population/national",
    ]) {
      const plain = await app.inject(url);
      const slashed = await app.inject(url.replace(/(\?|$)/, "/$1"));
      assert.equal(plain.statusCode, 200, url);
      assert.equal(slashed.statusCode, 200, url);
      assert.deepEqual(slashed.json().data, plain.json().data, url);
    }
    const docs = await app.inject("/docs/");
    assert.equal(docs.statusCode, 200);
    assert.match(docs.body, /<html lang="fr"/);
  });
});
