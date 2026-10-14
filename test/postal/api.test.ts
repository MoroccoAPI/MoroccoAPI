import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import type { MultiCodeCity, PostalCode } from "../../src/postal/types.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

const get = async (url: string) => {
  const response = await app.inject(url);
  return { status: response.statusCode, body: response.json() };
};

describe("postal/search", () => {
  it("requires a filter instead of returning the whole 1.9 MB register", async () => {
    for (const url of ["/api/v1/postal-codes", "/api/v1/postal-codes?type=neighborhood"]) {
      const { status, body } = await get(url);
      assert.equal(status, 400, url);
      assert.equal(body.error.code, "VALIDATION_ERROR");
      assert.match(body.error.message, /at least one of q, region_code, province_code or city/);
    }
  });

  it("searches names without accents or case and keeps the source spelling", async () => {
    const { status, body } = await get(`/api/v1/postal-codes?q=${encodeURIComponent("Afourér")}`);
    assert.equal(status, 200);
    assert.deepEqual(body.data, [{
      postal_code: "22052", type: "locality", name: "AFOURER", city: null,
      province_code: "azilal", region_code: "beni-mellal-khenifra", commune_code: null,
    }]);
    assert.equal(body.meta.total, 1);
  });

  it("treats a numeric query as a postal code prefix", async () => {
    const { body } = await get("/api/v1/postal-codes?q=100");
    assert.ok(body.data.length > 0);
    assert.ok(body.data.every((record: PostalCode) => record.postal_code.startsWith("100")));
  });

  it("returns every code of a neighbourhood and accepts a city in any spelling", async () => {
    const { body } = await get("/api/v1/postal-codes?city=rabat&q=quartier%20al%20boustane");
    assert.deepEqual(body.data.map((record: PostalCode) => record.postal_code), ["10150", "10210"]);
    const jadida = await get("/api/v1/postal-codes?city=El-Jadida&type=neighborhood");
    assert.equal(jadida.status, 200);
    assert.ok(jadida.body.data.length > 0);
    assert.ok(jadida.body.data.every((record: PostalCode) => record.city === "ELJADIDA" && record.province_code === "el-jadida"));
  });

  it("combines geographic and type filters", async () => {
    const { body } = await get("/api/v1/postal-codes?region_code=souss-massa&province_code=tiznit&type=locality");
    assert.ok(body.data.length > 0);
    for (const record of body.data as PostalCode[]) {
      assert.deepEqual([record.region_code, record.province_code, record.type], ["souss-massa", "tiznit", "locality"]);
    }
    const incompatible = await get("/api/v1/postal-codes?region_code=souss-massa&province_code=rabat");
    assert.equal(incompatible.status, 200);
    assert.deepEqual(incompatible.body.data, []);
  });

  it("rejects unknown cities, provinces and too-short queries", async () => {
    for (const url of [
      "/api/v1/postal-codes?city=paris",
      "/api/v1/postal-codes?province_code=atlantis",
      "/api/v1/postal-codes?q=a",
      "/api/v1/postal-codes?q=%20%20a%20",
      "/api/v1/postal-codes?type=street&q=rabat",
    ]) {
      const { status, body } = await get(url);
      assert.equal(status, 400, url);
      assert.equal(body.error.code, "VALIDATION_ERROR", url);
    }
  });
});

describe("postal/codes", () => {
  it("returns every place that uses a code", async () => {
    const { status, body } = await get("/api/v1/postal-codes/10000");
    assert.equal(status, 200);
    assert.equal(body.data.length, 5);
    assert.ok(body.data.every((record: PostalCode) => record.postal_code === "10000" && record.city === "RABAT"));
    assert.equal(body.meta.total, 5);
  });

  it("returns errors for unknown and malformed codes", async () => {
    const missing = await get("/api/v1/postal-codes/99999");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "RESOURCE_NOT_FOUND");
    for (const code of ["1000", "100000", "abcde"]) {
      assert.equal((await get(`/api/v1/postal-codes/${code}`)).status, 400, code);
    }
  });

  it("lists the 34 multi-code cities with their codes", async () => {
    const { status, body } = await get("/api/v1/postal-codes/cities");
    assert.equal(status, 200);
    assert.equal(body.data.length, 34);
    const rabat = body.data.find((city: MultiCodeCity) => city.name === "RABAT");
    assert.equal(rabat.commune_code, "rabat--rabat");
    assert.ok(rabat.postal_codes.includes("10000"));
    for (const city of body.data as MultiCodeCity[]) {
      assert.deepEqual([...city.postal_codes].sort(), city.postal_codes);
      assert.equal(new Set(city.postal_codes).size, city.postal_codes.length);
    }
  });

  it("uses the shared metadata envelope and publishes the paths in OpenAPI", async () => {
    const postal = (await get("/api/v1/postal-codes/10000")).body.meta;
    const geography = (await get("/api/v1/regions")).body.meta;
    assert.deepEqual(Object.keys(postal).sort(), Object.keys(geography).sort());
    assert.equal(postal.license, "ODbL-1.0");
    const spec = (await get("/openapi.json")).body;
    for (const path of ["/api/v1/postal-codes", "/api/v1/postal-codes/cities", "/api/v1/postal-codes/{code}"]) {
      assert.ok(spec.paths[path]?.get, path);
      assert.match(spec.paths[path].get.description, /September 2018.*missing/, `${path} documents the snapshot`);
    }
    assert.match(spec.tags.find((tag: { name: string }) => tag.name === "Postal codes").description, /September 2018 snapshot/);
  });
});
