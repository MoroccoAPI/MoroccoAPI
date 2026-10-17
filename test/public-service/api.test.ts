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

function assertSalaryMeta(meta: Record<string, unknown>, total: number) {
  assert.equal(meta.dataset, "public-service-salaries");
  assert.equal(meta.total, total);
  assert.equal(meta.license, "CC-BY-4.0");
  assert.equal(meta.retrieved_at, "2026-10-08");
  assert.equal(meta.transformation_version, "1.0.0");
  assert.equal(meta.value_type, "simulated-reference");
  assert.match(meta.notice as string, /not official salary entitlements/);
  const sources = meta.sources as Array<Record<string, string>>;
  assert.equal(sources.length, 1);
  assert.match(sources[0].producer, /Wadifa Info/);
  assert.equal(sources[0].license, "CC-BY-4.0");
  assert.ok(sources[0].resource_url.startsWith("https://zenodo.org/"));
}

describe("public-service/salaries", () => {
  it("lists every grade with a simulated-reference notice", async () => {
    const response = await app.inject("/api/v1/public-service/salaries");
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 370);
    assertSalaryMeta(body.meta, 370);

    const codes = new Set<string>();
    for (const record of body.data) {
      assert.match(record.code, /^[a-z0-9-]+$/);
      assert.ok(!codes.has(record.code));
      codes.add(record.code);
      assert.ok(Number.isSafeInteger(record.net_monthly_salary_mad));
      assert.ok(record.net_monthly_salary_mad > 0);
      assert.ok(record.grade.fr.length > 0);
      assert.ok(record.corps.ar.length > 0);
      assert.ok(record.reference_url.startsWith("https://www.wadifa-info.com/"));
    }
    const values = body.data.map((record: { net_monthly_salary_mad: number }) => record.net_monthly_salary_mad);
    assert.equal(Math.min(...values), 3743);
    assert.equal(Math.max(...values), 45405);
  });

  it("searches grade names without accents", async () => {
    const response = await app.inject("/api/v1/public-service/salaries?q=ingenieur%20d%27etat");
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.ok(body.data.length > 0);
    for (const record of body.data) {
      assert.match(record.grade.fr.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase(), /ingenieur d'etat/);
    }
    assertSalaryMeta(body.meta, body.data.length);
  });

  it("filters by corps and salary range", async () => {
    const corps = encodeURIComponent("أساتذة التربية الوطنية");
    const response = await app.inject(`/api/v1/public-service/salaries?corps=${corps}&min_salary=9000&max_salary=11000`);
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.ok(body.data.length > 0);
    for (const record of body.data) {
      assert.equal(record.corps.ar, "أساتذة التربية الوطنية");
      assert.ok(record.net_monthly_salary_mad >= 9000 && record.net_monthly_salary_mad <= 11000);
    }
  });

  it("rejects an inverted salary range", async () => {
    const response = await app.inject("/api/v1/public-service/salaries?min_salary=9000&max_salary=1000");
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  });

  it("rejects a malformed salary bound", async () => {
    const response = await app.inject("/api/v1/public-service/salaries?min_salary=abc");
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");
  });

  it("returns one grade by code", async () => {
    const response = await app.inject("/api/v1/public-service/salaries/adjoint-administratif-1er-grade");
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.grade.fr, "Adjoint administratif 1er grade");
    assert.equal(body.data.net_monthly_salary_mad, 5566);
    assertSalaryMeta(body.meta, 1);
  });

  it("returns 404 for an unknown grade code", async () => {
    const response = await app.inject("/api/v1/public-service/salaries/no-such-grade");
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("publishes both endpoints in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    assert.equal(response.statusCode, 200);

    const paths = response.json().paths;
    for (const path of ["/api/v1/public-service/salaries", "/api/v1/public-service/salaries/{code}"]) {
      const operation = paths[path]?.get;
      assert.ok(operation, path);
      assert.equal(operation.tags[0], "Public service");
      assert.ok(operation.responses["200"]);
    }
  });
});
