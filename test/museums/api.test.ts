import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";
import type { Museum } from "../../src/museums/types.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Museums API", () => {
  it("serves all 23 source museums with bilingual names and visible freshness/coverage", async () => {
    const response = await app.inject("/api/v1/museums");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().meta.pagination, {
      limit: 100, offset: 0, count: 23, has_more: false, next_offset: null,
    });
    const body = await collectAllPages(app, "/api/v1/museums");
    assert.equal(body.data.length, 23);
    assert.equal(body.meta.total, 23);
    assert.equal(new Set(body.data.map((r: Museum) => r.id)).size, 23);
    assert.equal(body.meta.source_version, "Septembre 2026");
    assert.equal(body.meta.retrieved_at, "2026-10-14");
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.match(body.meta.scope, /not an exhaustive/);
    assert.deepEqual(body.meta.sources.map((r: { source_updated_at: string }) => r.source_updated_at), ["2026-10-02", "2026-09-28", "2024-11-22"]);
    for (const record of body.data as Museum[]) {
      assert.ok(record.name.fr && record.name.ar);
      assert.equal(record.name.en, null);
      assert.equal(record.coordinates, null);
      assert.equal(record.operating_status, "unknown");
      assert.ok(!("provenance" in record));
      assert.ok(!("guide_name_fr" in record));
      assert.ok(!("raw" in record.contact));
    }
  });

  it("combines city, region and name filters using the project's geography codes", async () => {
    const response = await app.inject("/api/v1/museums?city_code=tanger-assilah--tanger&region_code=tanger-tetouan-al-hoceima&q=kasbah");
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 2);
    assert.ok(response.json().data.every((r: Museum) => r.city_code === "tanger-assilah--tanger"));
    const incompatible = await app.inject("/api/v1/museums?city_code=rabat--rabat&region_code=fes-meknes");
    assert.equal(incompatible.statusCode, 200);
    assert.deepEqual(incompatible.json().data, []);
    assert.equal(incompatible.json().meta.total, 0);
    const uncovered = await app.inject("/api/v1/museums?region_code=oriental");
    assert.equal(uncovered.statusCode, 200);
    assert.equal(uncovered.json().meta.total, 0);
  });

  it("searches French without accents, Arabic without diacritics, guide aliases and city names", async () => {
    for (const q of ["musee d'azilal", "مَتْحَف أَزِيلال"]) {
      const response = await app.inject(`/api/v1/museums?q=${encodeURIComponent(q)}`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().meta.total, 1);
      assert.equal(response.json().data[0].city_code, "azilal--azilal");
    }
    const alias = await app.inject("/api/v1/museums?q=photographie&city_code=casablanca--casablanca");
    assert.equal(alias.json().meta.total, 1);
    assert.match(alias.json().data[0].name.fr, /photographic/);
    const city = await app.inject("/api/v1/museums?q=tetouan");
    assert.equal(city.json().meta.total, 2);
  });

  it("returns a museum by its stable ID", async () => {
    const list = (await app.inject("/api/v1/museums")).json();
    const record = list.data[0];
    const response = await app.inject(`/api/v1/museums/${record.id}`);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, record);
    assert.equal(response.json().meta.total, 1);
  });

  it("retains incomplete contacts and the works conflict without fabricating visitor facts", async () => {
    const azilal = (await app.inject("/api/v1/museums?city_code=azilal--azilal")).json().data[0];
    assert.equal(azilal.contact.phone_e164, null);
    assert.equal(azilal.contact.phone_status, "invalid_format");
    assert.ok(azilal.quality_flags.includes("phone_invalid_format"));
    const darSiSaid = (await app.inject("/api/v1/museums?q=dar%20si%20said")).json().data[0];
    assert.ok(darSiSaid.quality_flags.includes("hours_conflict_with_guide"));
    assert.equal(darSiSaid.operating_status, "unknown");
  });

  it("rejects invalid geographic codes, short/blank queries and invalid ID syntax", async () => {
    for (const url of [
      "/api/v1/museums?city_code=invalid", "/api/v1/museums?region_code=invalid",
      "/api/v1/museums?q=a", "/api/v1/museums?q=%20%20", "/api/v1/museums?q=%D9%8E%D9%8E",
      `/api/v1/museums?q=${"a".repeat(101)}`, "/api/v1/museums/bad_id",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.equal(typeof response.json().error.request_id, "string");
    }
  });

  it("uses the standard 404 envelope for an unknown museum", async () => {
    const response = await app.inject("/api/v1/museums/fnm-not-found");
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
    assert.equal(typeof response.json().error.request_id, "string");
  });

  it("documents museum filters, response fields and error envelopes in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const list = spec.paths["/api/v1/museums"].get;
    assert.deepEqual(list.tags, ["Museums"]);
    assert.deepEqual(list.parameters.map((p: { name: string }) => p.name).sort(), ["city_code", "limit", "offset", "q", "region_code"]);
    const detail = spec.paths["/api/v1/museums/{id}"].get;
    assert.ok(detail.responses["200"] && detail.responses["400"] && detail.responses["404"]);
  });
});
