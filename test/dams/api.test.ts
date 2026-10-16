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
  it("lists dams from nine basins with each dam's latest published level and source caveats", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/dams" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.meta.dataset, "morocco-dams");
    assert.equal(body.meta.license, "mixed");
    assert.equal(body.meta.license_url, null);
    assert.equal(body.meta.total, 25);
    assert.equal(body.meta.coverage.basin, null);
    assert.equal(body.meta.coverage.basins.length, 9);
    assert.equal(body.meta.coverage.complete_national_coverage, false);
    assert.equal(body.meta.coverage.from, "2026-08-01");
    assert.equal(body.meta.coverage.to, "2026-10-12");
    assert.equal(body.meta.coverage.real_time, false);
    assert.ok(body.meta.coverage.limitations.length > 0);
    assert.deepEqual(body.meta.sources.map((source: { id: string }) => source.id).sort(), [
      "abht-tensift-2026-08", "abht-tensift-2026-09", "maadialna-2026-10-12",
    ]);
    for (const source of body.meta.sources) {
      assert.ok(source.producer.length > 0);
      if (source.id === "maadialna-2026-10-12") {
        assert.equal(source.license, null);
        assert.equal(source.license_url, null);
        assert.equal(source.resource_url, "https://maadialna.ma/ar/get-bassin");
      } else {
        assert.equal(source.license, "ODbL-1.0");
        assert.ok(source.source_url.startsWith("https://data.gov.ma/"));
        assert.ok(source.resource_url.startsWith("https://data.gov.ma/"));
      }
    }
    assert.deepEqual(body.data.filter((dam: { basin: string }) => dam.basin === "tensift")
      .map((dam: { id: string }) => dam.id).sort(), [
      "abou-el-abess-sebti",
      "bge-my-abdrhmane",
      "lalla-takerkoust",
      "sd-mohamed-ben-slimane-el-jazouli",
      "yacoub-el-mansour",
    ]);
    for (const dam of body.data) {
      assert.ok(body.meta.coverage.basins.includes(dam.basin));
      assert.ok(dam.name.fr?.length > 0 || dam.name.ar?.length > 0);
      assert.equal(dam.latest_level.dam_id, dam.id);
      if (dam.latest_level.source_id === "maadialna-2026-10-12") {
        assert.equal(dam.latest_level.date, "2026-10-12");
        assert.equal(dam.latest_level.date_basis, "dashboard_headline");
        assert.equal(dam.latest_level.capacity_mm3, null);
        assert.ok(dam.name.ar.length > 0);
      } else {
        assert.equal(dam.basin, "tensift");
        assert.equal(dam.latest_level.date, "2026-09-30");
        assert.equal(dam.latest_level.source_id, "abht-tensift-2026-09");
        assert.equal(dam.latest_level.date_basis, "source_calendar");
      }
    }
    const yacoub = body.data.find((dam: { id: string }) => dam.id === "yacoub-el-mansour");
    assert.equal(yacoub.name.fr, "Yacoub El Mansour");
    assert.equal(yacoub.latest_level.volume_mm3, 43);
    assert.equal(yacoub.latest_level.filling_rate_pct, 75);
    assert.equal(yacoub.latest_level.previous_year_filling_rate_pct, 33);
    assert.equal(body.data.filter((dam: { latest_level: { source_id: string } }) =>
      dam.latest_level.source_id === "maadialna-2026-10-12").length, 22);
  });

  it("filters all nine covered basins and returns no records for an unknown basin", async () => {
    const counts = {
      tensift: 5, bouregreg: 2, "guir-ziz-gheris": 2, sebou: 3, moulouya: 2,
      "souss-massa": 3, loukkos: 3, "draa-oued-noun": 2, "oum-er-rbia": 3,
    };
    for (const [basin, count] of Object.entries(counts)) {
      const covered = await app.inject({ method: "GET", url: `/api/v1/dams?basin=${basin}` });
      assert.equal(covered.statusCode, 200, basin);
      assert.equal(covered.json().data.length, count, basin);
      assert.equal(covered.json().meta.total, count, basin);
      assert.equal(covered.json().meta.coverage.basin, basin, basin);
      assert.ok(covered.json().data.every((dam: { basin: string }) => dam.basin === basin));
    }

    const other = await app.inject({ method: "GET", url: "/api/v1/dams?basin=unknown-basin" });
    assert.equal(other.statusCode, 200);
    assert.deepEqual(other.json().data, []);
    assert.equal(other.json().meta.total, 0);
    assert.equal(other.json().meta.coverage.complete_national_coverage, false);
  });

  it("returns daily history in ascending order with inclusive date bounds", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 62);
    assert.equal(body.meta.total, 62);
    assert.equal(body.data[0].date, "2026-08-01");
    assert.equal(body.data.at(-1).date, "2026-10-12");
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
    const historicalLast = body.data.find((level: { date: string }) => level.date === "2026-09-30");
    assert.deepEqual(single.json().data, [historicalLast]);
    assert.equal(historicalLast.volume_mm3, 41.61);
    assert.equal(historicalLast.filling_rate_pct, 72.42819843342036);
    assert.equal(historicalLast.capacity_mm3, 57.45);
    assert.equal(historicalLast.date_basis, "source_calendar");

    const september = await app.inject("/api/v1/dams/yacoub-el-mansour/levels?from=2026-09-01&to=2026-09-30");
    assert.equal(september.statusCode, 200);
    assert.equal(september.json().meta.total, 30);
    assert.ok(september.json().data.every((level: { source_id: string }) => level.source_id === "abht-tensift-2026-09"));

    const october = await app.inject("/api/v1/dams/yacoub-el-mansour/levels?from=2026-10-01");
    assert.equal(october.statusCode, 200);
    assert.equal(october.json().meta.total, 1);
    assert.deepEqual(october.json().data, [body.data.at(-1)]);

    const upperBound = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?to=2026-08-02" });
    assert.equal(upperBound.statusCode, 200);
    assert.deepEqual(upperBound.json().data.map((level: { date: string }) => level.date), ["2026-08-01", "2026-08-02"]);

    const empty = await app.inject({ method: "GET", url: "/api/v1/dams/yacoub-el-mansour/levels?from=2026-10-13" });
    assert.equal(empty.statusCode, 200);
    assert.deepEqual(empty.json().data, []);
    assert.equal(empty.json().meta.total, 0);
  });

  it("returns only the published observation for an added dam without creating a prior-year history", async () => {
    const response = await app.inject("/api/v1/dams/tiddas/levels");
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 1);
    assert.equal(response.json().meta.coverage.basin, "bouregreg");
    assert.deepEqual(response.json().data[0], {
      dam_id: "tiddas", date: "2026-10-12", date_basis: "dashboard_headline",
      capacity_mm3: null, volume_mm3: 461, filling_rate_pct: 91,
      previous_year_filling_rate_pct: null, source_id: "maadialna-2026-10-12",
      source_ref: { basin_code: "MH5", dam_index: 2 },
    });
    const priorYear = await app.inject("/api/v1/dams/tiddas/levels?from=2025-01-01&to=2025-12-31");
    assert.equal(priorYear.statusCode, 200);
    assert.equal(priorYear.json().meta.total, 0);
    assert.deepEqual(priorYear.json().data, []);
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
