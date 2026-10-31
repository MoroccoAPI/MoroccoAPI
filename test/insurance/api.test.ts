import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadInsuranceIntermediaries } from "../../src/insurance/data.js";
import type { InsuranceIntermediary } from "../../src/insurance/types.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app?.close(); });

describe("insurance intermediary API", () => {
  it("serves a bounded snapshot with ACAPS provenance and explicit coverage", async () => {
    const snapshot = await loadInsuranceIntermediaries();
    const response = await app.inject("/api/v2/insurance/intermediaries");
    assert.equal(response.statusCode, 200);
    const { data, meta } = response.json();
    assert.equal(data.length, 100);
    assert.equal(meta.total, snapshot.intermediaries.length);
    assert.equal(meta.source_record_count, 3614);
    assert.equal(meta.coverage.records, meta.total);
    assert.equal(meta.coverage.complete, snapshot.manifest.coverage_complete);
    assert.equal(meta.license, null);
    assert.equal(meta.redistribution_status, "permission-not-obtained");
    assert.equal(meta.real_time, false);
    assert.equal(meta.source_updated_at, null);
    assert.match(meta.sources[0].source_url, /^https:\/\/acaps\.ma\//);
    for (const row of data) {
      assert.deepEqual(Object.keys(row).sort(), ["acaps_code", "category", "city", "insurer", "name"]);
    }
    assert.deepEqual(meta.pagination, { limit: 100, offset: 0, count: 100, has_more: true, next_offset: 100 });
  });

  it("finds Fès locality labels regardless of accents and case and combines filters", async () => {
    const ascii = await app.inject("/api/v2/insurance/intermediaries?city=Fes&limit=500");
    const accented = await app.inject("/api/v2/insurance/intermediaries?city=%20F%C3%88S%20&limit=500");
    assert.equal(ascii.statusCode, 200);
    assert.deepEqual(accented.json(), ascii.json());
    assert.ok(ascii.json().data.length > 0);
    assert.ok(ascii.json().data.every((row: InsuranceIntermediary) => /f[eè]s/i.test(row.city ?? "")));
    const agents = (await app.inject("/api/v2/insurance/intermediaries?city=Fes&category=agent&limit=500")).json();
    assert.ok(agents.data.length > 0);
    assert.deepEqual(agents.data, ascii.json().data.filter((row: InsuranceIntermediary) => row.category === "agent"));
    const empty = await app.inject("/api/v2/insurance/intermediaries?city=not-a-source-locality");
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().meta.total, 0);
    assert.deepEqual(empty.json().data, []);
  });

  it("searches codes and retrieves source codes without stripping zeros or branch suffixes", async () => {
    const search = await app.inject("/api/v2/insurance/intermediaries?q=a3420");
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().data[0].acaps_code, "A3420");
    for (const code of ["A3420", "B0151", "AGT5285-00000"]) {
      const result = await app.inject(`/api/v2/insurance/intermediaries/${code.toLowerCase()}`);
      assert.equal(result.statusCode, 200);
      assert.equal(result.json().data.length, 1);
      assert.equal(result.json().data[0].acaps_code, code);
      assert.equal(result.json().meta.total, 1);
    }
    const conflict = await app.inject("/api/v2/insurance/intermediaries/COU5081-00000");
    assert.equal(conflict.statusCode, 200);
    assert.equal(conflict.json().meta.total, 2);
    assert.deepEqual(conflict.json().data.map((row: InsuranceIntermediary) => row.city).sort(), ["Casablanca-Aîn-Chock", "Casablanca-El Maarif"].sort());
    const second = await app.inject("/api/v2/insurance/intermediaries/COU5081-00000?limit=1&offset=1");
    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json().data, conflict.json().data.slice(1));
    assert.equal(second.json().meta.total, 2);
    const absent = await app.inject("/api/v2/insurance/intermediaries/UNKNOWN9999");
    assert.equal(absent.statusCode, 404);
    assert.equal(absent.json().error.code, "RESOURCE_NOT_FOUND");
    assert.match(absent.json().error.message, /snapshot/);
  });

  it("paginates filtered results without changing the total or snapshot coverage", async () => {
    const all = (await app.inject("/api/v2/insurance/intermediaries?city=Fes&limit=500")).json();
    const page = (await app.inject("/api/v2/insurance/intermediaries?city=Fes&limit=2&offset=2")).json();
    assert.deepEqual(page.data, all.data.slice(2, 4));
    assert.equal(page.meta.total, all.meta.total);
    assert.deepEqual(page.meta.coverage, all.meta.coverage);
    assert.deepEqual(page.meta.pagination, { limit: 2, offset: 2, count: 2, has_more: true, next_offset: 4 });
    const beyond = (await app.inject(`/api/v2/insurance/intermediaries?city=Fes&offset=${all.meta.total}`)).json();
    assert.deepEqual(beyond.data, []);
    assert.equal(beyond.meta.pagination.next_offset, null);
  });

  it("rejects invalid and repeated filters with the shared error contract", async () => {
    for (const query of ["q=", "q=%20%20", "q=a", "city=%20%20", "city=e%CC%81", "category=insurer",
      "city=Fes&city=Rabat", "q=foo&q=bar", "category=agent&category=broker", "licensed=true", "limit=501"]) {
      const response = await app.inject(`/api/v2/insurance/intermediaries?${query}`);
      assert.equal(response.statusCode, 400, query);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
      assert.ok(response.json().error.request_id);
    }
    assert.equal((await app.inject("/api/v2/insurance/intermediaries/invalid_code")).statusCode, 400);
    assert.equal((await app.inject(`/api/v2/insurance/intermediaries/${"A".repeat(65)}`)).statusCode, 400);
  });
});
