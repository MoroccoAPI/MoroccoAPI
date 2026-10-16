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

describe("dams", () => {
  it("lists the five published Tensift dams with their latest recorded levels", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/dams" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.meta.dataset, "tensift-dams");
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.equal(body.meta.total, 5);
    assert.equal(body.meta.coverage.basin, "tensift");
    assert.equal(body.meta.coverage.from, "2026-08-01");
    assert.equal(body.meta.coverage.to, "2026-09-30");
    assert.equal(body.meta.coverage.real_time, false);
    assert.ok(body.meta.coverage.limitations.length > 0);
    assert.deepEqual(body.meta.sources.map((source: { id: string }) => source.id).sort(), ["abht-tensift-2026-08", "abht-tensift-2026-09"]);
    for (const source of body.meta.sources) {
      assert.equal(source.license, "ODbL-1.0");
      assert.ok(source.producer.length > 0);
      assert.ok(source.source_url.startsWith("https://data.gov.ma/"));
      assert.ok(source.resource_url.startsWith("https://data.gov.ma/"));
    }
    assert.deepEqual(body.data.map((dam: { id: string }) => dam.id).sort(), [
      "abou-el-abess-sebti",
      "bge-my-abdrhmane",
      "lalla-takerkoust",
      "sd-mohamed-ben-slimane-el-jazouli",
      "yacoub-el-mansour",
    ]);
    for (const dam of body.data) {
      assert.ok(dam.name.fr.length > 0);
      assert.equal(dam.basin, "tensift");
      assert.equal(dam.latest_level.dam_id, dam.id);
      assert.equal(dam.latest_level.date, "2026-09-30");
      assert.equal(dam.latest_level.source_id, "abht-tensift-2026-09");
    }
    const yacoub = body.data.find((dam: { id: string }) => dam.id === "yacoub-el-mansour");
    assert.equal(yacoub.latest_level.volume_mm3, 41.61);
    assert.equal(yacoub.latest_level.filling_rate_pct, 72.42819843342036);
    assert.equal(yacoub.latest_level.capacity_mm3, 57.45);
  });

  it("filters the covered basin and returns no records for other basins", async () => {
    const covered = await app.inject({ method: "GET", url: "/api/v1/dams?basin=tensift" });
    assert.equal(covered.statusCode, 200);
    assert.equal(covered.json().data.length, 5);
    assert.equal(covered.json().meta.total, 5);

    const other = await app.inject({ method: "GET", url: "/api/v1/dams?basin=bouregreg" });
    assert.equal(other.statusCode, 200);
    assert.deepEqual(other.json().data, []);
    assert.equal(other.json().meta.total, 0);
    assert.equal(other.json().meta.coverage.basin, "tensift");
  });

  it("returns daily history in ascending order with inclusive date bounds", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 61);
    assert.equal(body.meta.total, 61);
    assert.equal(body.data[0].date, "2026-08-01");
    assert.equal(body.data.at(-1).date, "2026-09-30");
    assert.ok(body.data.every((level: { dam_id: string }) => level.dam_id === "yacoub-el-mansour"));
    const dates = body.data.map((level: { date: string }) => level.date);
    assert.deepEqual(dates, [...dates].sort());
    assert.equal(new Set(dates).size, dates.length);

    const boundary = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?from=2026-08-31&to=2026-09-01" });
    assert.equal(boundary.statusCode, 200);
    assert.equal(boundary.json().meta.total, 2);
    assert.deepEqual(boundary.json().data.map((level: { date: string; source_id: string }) => [level.date, level.source_id]), [
      ["2026-08-31", "abht-tensift-2026-08"],
      ["2026-09-01", "abht-tensift-2026-09"],
    ]);

    const single = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?from=2026-09-30&to=2026-09-30" });
    assert.equal(single.statusCode, 200);
    assert.deepEqual(single.json().data, [body.data.at(-1)]);

    const upperBound = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?to=2026-08-02" });
    assert.equal(upperBound.statusCode, 200);
    assert.deepEqual(upperBound.json().data.map((level: { date: string }) => level.date), ["2026-08-01", "2026-08-02"]);

    const empty = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?from=2026-10-01" });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json().data, []);
    assert.equal(empty.json().meta.total, 0);
  });

  it("rejects invalid basin, dam and date inputs with the shared error contract", async () => {
    for (const url of [
      "/api/v1/dams?basin=Tensift",
      "/api/v1/dams/bad_id/levels",
      "/api/v1/dams/yacoub-el-mansour/levels?from=2026-02-30",
      "/api/v1/dams/yacoub-el-mansour/levels?to=2026-04-31",
      "/api/v1/dams/yacoub-el-mansour/levels?from=2026-8-01",
      "/api/v1/dams/yacoub-el-mansour/levels?from=2026-09-30&to=2026-08-01",
      "/api/v1/dams/yacoub-el-mansour/levels?from=2026-08-01&from=2026-09-01",
    ]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR", url);
      assert.ok(response.json().error.request_id.length > 0, url);
    }

    const unknown = await app.inject({ method: "GET", url: "/api/v1/dams/unknown-dam/levels" });
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().error.code, "RESOURCE_NOT_FOUND");
    assert.ok(unknown.json().error.request_id.length > 0);
  });
});
