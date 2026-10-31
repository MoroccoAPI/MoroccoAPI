import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import type { Consulate } from "../../src/consulates/types.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app?.close(); });

describe("consulate API", () => {
  it("serves the snapshot with truthful licensing, freshness and coverage metadata", async () => {
    const response = await app.inject("/api/v2/consulates");
    assert.equal(response.statusCode, 200);
    const { data, meta } = response.json();
    assert.equal(data.length, 56);
    assert.equal(meta.total, 56);
    assert.equal(meta.dataset, "moroccan-consulates");
    assert.equal(meta.license, null);
    assert.equal(meta.redistribution_status, "permission-not-obtained");
    assert.equal(meta.retrieved_at, "2026-10-31");
    assert.equal(meta.source_updated_at, null);
    assert.equal(meta.coverage.countries, 15);
    assert.equal(meta.coverage.complete, false);
    assert.equal(meta.coverage.real_time, false);
    assert.equal(meta.sources[0].source_url, "https://diplomatie.ma/fr/annuaire");
    assert.equal(new Set(data.map((item: Consulate) => item.id)).size, 56);
    for (const item of data) {
      assert.deepEqual(Object.keys(item).sort(), ["id", "name", "country", "city", "address", "phones", "website", "source_names", "quality_flags"].sort());
      assert.ok(item.name.fr.startsWith("CONSULAT"));
    }
  });

  it("filters France case-insensitively without claiming complete worldwide coverage", async () => {
    const upper = await app.inject("/api/v2/consulates?country=FR");
    const lower = await app.inject("/api/v2/consulates?country=fr");
    assert.equal(upper.statusCode, 200);
    assert.deepEqual(upper.json(), lower.json());
    assert.equal(upper.json().meta.total, 16);
    assert.equal(upper.json().meta.coverage.records, 56);
    assert.ok(upper.json().data.every((item: Consulate) => item.country.code === "FR"));
    const empty = await app.inject("/api/v2/consulates?country=JP");
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json().data, []);
    assert.equal(empty.json().meta.total, 0);
  });

  it("returns a stable detail record and preserves missing or suspect data explicitly", async () => {
    const paris = await app.inject("/api/v2/consulates/fr-paris");
    assert.equal(paris.statusCode, 200);
    assert.equal(paris.json().data.address, "12 RUE DE LA SAIDA 75015 PARIS");
    assert.equal(paris.json().data.phones[0].e164, "+33156567201");
    assert.equal(paris.json().meta.total, 1);
    const toronto = (await app.inject("/api/v2/consulates/ca-toronto")).json().data;
    assert.equal(toronto.address, null);
    assert.deepEqual(toronto.phones, []);
    assert.ok(toronto.quality_flags.includes("incomplete-contact"));
    const algeria = (await app.inject("/api/v2/consulates/dz-sidi-bel-abbes")).json().data;
    assert.equal(algeria.website, null);
    assert.equal(algeria.phones[0].e164, null);
    assert.ok(algeria.quality_flags.includes("phone-country-mismatch"));
    const merged = (await app.inject("/api/v2/consulates/nl-den-bosch")).json().data;
    assert.equal(merged.source_names.length, 2);
    assert.equal(merged.phones[0].e164, "+31736141299");
    assert.ok(merged.quality_flags.includes("duplicate-merged"));
  });

  it("validates country and ID inputs and uses the shared error contract", async () => {
    for (const url of [
      "/api/v2/consulates?country=France", "/api/v2/consulates?country=1F",
      "/api/v2/consulates?country=", "/api/v2/consulates?country=FR&country=ES",
      "/api/v2/consulates/INVALID_ID",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.ok(response.json().error.request_id);
    }
    const missing = await app.inject("/api/v2/consulates/fr-unknown-city");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("paginates after filtering and preserves total matching records", async () => {
    const full = (await app.inject("/api/v2/consulates?country=FR")).json();
    const page = await app.inject("/api/v2/consulates?country=FR&limit=2&offset=2");
    assert.equal(page.statusCode, 200);
    assert.deepEqual(page.json().data, full.data.slice(2, 4));
    assert.equal(page.json().meta.total, 16);
    assert.deepEqual(page.json().meta.pagination, { limit: 2, offset: 2, count: 2, has_more: true, next_offset: 4 });
    const empty = (await app.inject("/api/v2/consulates?country=FR&offset=16")).json();
    assert.deepEqual(empty.data, []);
    assert.equal(empty.meta.pagination.next_offset, null);
  });

  it("documents collection and detail routes in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    assert.ok(spec.paths["/api/v2/consulates"].get.parameters.some((p: { name: string }) => p.name === "country"));
    assert.ok(spec.paths["/api/v2/consulates/{id}"].get.responses[404]);
  });
});
