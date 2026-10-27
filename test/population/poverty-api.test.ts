import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

interface Row {
  level: string;
  code: string | null;
  region_code: string | null;
  province_code: string | null;
  area: string;
  year: number;
  poverty_rate: number | null;
  mpi_trend: string | null;
  aligned_with_dakhla: boolean;
}

describe("population/poverty", () => {
  it("lists the regions for all areas in 2024 by default, with metadata and pagination", async () => {
    const response = await app.inject("/api/v2/population/poverty");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 12);
    assert.ok(body.data.every((row: Row) => row.level === "regions" && row.area === "all" && row.year === 2024));
    assert.equal(body.data[0].code, "tanger-tetouan-al-hoceima");
    assert.equal(body.data[0].poverty_rate, 7.093763641141947);
    assert.deepEqual(Object.keys(body.data[0].deprivation_rates), [
      "child_mortality", "disability", "school_attendance", "years_of_schooling", "electricity",
      "water", "sanitation", "housing", "cooking_fuel", "communication_assets",
    ]);
    assert.deepEqual(body.meta.pagination, { limit: 100, offset: 0, count: 12, has_more: false, next_offset: null });
    assert.equal(body.meta.dataset, "population-poverty");
    assert.equal(body.meta.total, 12);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(body.meta.sources[0].resource_url, "https://www.hcp.ma/file/245096/");
  });

  it("pages through every commune and filters by area, year, region and province", async () => {
    const all = await collectAllPages<Row>(app, "/api/v2/population/poverty?level=communes&year=2014");
    assert.equal(all.data.length, 1503);
    assert.ok(all.data.every((row) => row.year === 2014 && row.mpi_trend === null));

    const rural = await app.inject("/api/v2/population/poverty?level=communes&area=rural&year=2014&province_code=oued-ed-dahab&limit=500");
    assert.equal(rural.statusCode, 200);
    const rows: Row[] = rural.json().data;
    assert.ok(rows.length > 0 && rows.every((row) => row.province_code === "oued-ed-dahab" && row.area === "rural"));
    assert.equal(rows.find((row) => row.code === "oued-ed-dahab--mijik")?.aligned_with_dakhla, true);

    const urban = await app.inject("/api/v2/population/poverty?level=communes&area=urban&region_code=rabat-sale-kenitra&limit=500");
    const urbanRows: Row[] = urban.json().data;
    assert.ok(urbanRows.length > 0 && urbanRows.every((row) => row.region_code === "rabat-sale-kenitra" && row.area === "urban"));
    assert.ok(urbanRows.length < 200, "rural communes without urban values are omitted");

    const region = await app.inject("/api/v2/population/poverty?level=regions&region_code=oriental");
    assert.deepEqual(region.json().data.map((row: Row) => row.code), ["oriental"]);
  });

  it("returns national and territory profiles with optional area and year filters", async () => {
    const national = await app.inject("/api/v2/population/national/poverty");
    assert.equal(national.statusCode, 200);
    const body = national.json();
    assert.equal(body.data.territory.level, "national");
    assert.equal(body.data.observations.length, 6);
    assert.equal(body.meta.total, 1);

    const filtered = await app.inject("/api/v2/population/communes/rabat--rabat/poverty?area=urban&year=2024");
    assert.equal(filtered.statusCode, 200);
    assert.equal(filtered.json().data.territory.code, "rabat--rabat");
    assert.deepEqual(filtered.json().data.observations.map((item: Row) => `${item.area}|${item.year}`), ["urban|2024"]);

    for (const [level, code] of [
      ["regions", "casablanca-settat"], ["subdivisions", "rabat"],
      ["prefectures-of-arrondissements", "casablanca--prefecture-of-arrondissements--ain-chock"],
      ["arrondissements", "casablanca--ain-chock"],
    ]) {
      const response = await app.inject(`/api/v2/population/${level}/${code}/poverty`);
      assert.equal(response.statusCode, 200, `${level}/${code}`);
      assert.equal(response.json().data.territory.level, level);
    }
  });

  it("keeps the existing population routes and mirrors the new routes under /api/v1", async () => {
    assert.equal((await app.inject("/api/v2/population/regions/casablanca-settat")).json().meta.dataset, "regional-population");
    const v1 = await app.inject("/api/v1/population/regions/casablanca-settat/poverty");
    assert.equal(v1.statusCode, 200);
    assert.equal(v1.headers.link, '</api/v2/population/regions/casablanca-settat/poverty>; rel="successor-version"');
    assert.deepEqual(v1.json(), (await app.inject("/api/v2/population/regions/casablanca-settat/poverty")).json());
  });

  it("rejects unknown territories, levels and filter values", async () => {
    const missing = await app.inject("/api/v2/population/communes/unknown-commune/poverty");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
    for (const url of [
      "/api/v2/population/towns/rabat/poverty",
      "/api/v2/population/national/x/poverty",
      "/api/v2/population/poverty?year=2020",
      "/api/v2/population/poverty?area=suburb",
      "/api/v2/population/poverty?level=cercles",
      "/api/v2/population/national/poverty?year=2004",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR", url);
    }
  });

  it("documents the three routes in OpenAPI under Population", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    for (const path of [
      "/api/v2/population/poverty", "/api/v2/population/national/poverty", "/api/v2/population/{level}/{code}/poverty",
    ]) {
      assert.deepEqual(spec.paths[path]?.get?.tags, ["Population"], path);
    }
    assert.equal(spec.paths["/api/v1/population/poverty"], undefined);
  });
});
