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
  code: string;
  region_code: string;
  area: string;
  year: number;
  activity_rate: number | null;
  employment_rate: number | null;
  unemployment_rate: number | null;
}

describe("population/labour", () => {
  it("lists all-areas rates by province and year by default, with metadata and pagination", async () => {
    const response = await app.inject("/api/v2/population/labour");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data.length, 100);
    assert.deepEqual(body.data[0], {
      code: "agadir-ida-ou-tanane", hcp_code: "09.001",
      name: { ar: "أكادير-إدا وتنان", fr: "Agadir-Ida-Ou-Tanane", en: "Agadir-Ida-Ou-Tanane" },
      region_code: "souss-massa", area: "all", year: 2017,
      activity_rate: 41.9, employment_rate: 36.2, unemployment_rate: 13.5,
    });
    assert.ok(body.data.every((row: Row) => row.area === "all"));
    assert.deepEqual(body.meta.pagination, { limit: 100, offset: 0, count: 100, has_more: true, next_offset: 100 });
    assert.equal(body.meta.dataset, "population-labour");
    assert.equal(body.meta.total, 664);
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.deepEqual(body.meta.sources.map((source: { source_url: string }) => source.source_url), [
      "https://data.gov.ma/data/fr/dataset/data_imt_txact_02",
      "https://data.gov.ma/data/fr/dataset/data_imt_txemp_02",
      "https://data.gov.ma/data/fr/dataset/data_imt_txch_02",
    ]);
  });

  it("pages through every area and filters by province, region, year and year range", async () => {
    for (const [area, total] of [["all", 664], ["urban", 648], ["rural", 586]] as const) {
      const all = await collectAllPages<Row>(app, `/api/v2/population/labour?area=${area}`);
      assert.equal(all.data.length, total, area);
      assert.ok(all.data.every((row) => row.area === area), area);
    }

    const province = (await app.inject("/api/v2/population/labour?province_code=al-hoceima")).json();
    assert.deepEqual(province.data.map((row: Row) => row.year), [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    assert.deepEqual(province.data.map((row: Row) => row.unemployment_rate), [7.8, 7, 8.4, 11.4, 10, 8.5, 10.2, 8, 6.7]);

    const region = (await app.inject("/api/v2/population/labour?region_code=dakhla-oued-ed-dahab&area=rural")).json();
    assert.deepEqual(region.data.map((row: Row) => [row.code, row.year, row.activity_rate]), [["oued-ed-dahab", 2020, 78.2]]);

    const year = (await app.inject("/api/v2/population/labour?year=2025&area=urban&limit=500")).json();
    assert.equal(year.meta.total, 72);
    assert.ok(year.data.every((row: Row) => row.year === 2025 && row.area === "urban"));

    const range = (await app.inject("/api/v2/population/labour?province_code=rabat&from=2020&to=2022")).json();
    assert.deepEqual(range.data.map((row: Row) => row.year), [2020, 2021, 2022]);
    const single = (await app.inject("/api/v2/population/labour?province_code=rabat&from=2025&to=2025")).json();
    assert.deepEqual(single.data.map((row: Row) => row.year), [2025]);

    const unknown = await app.inject("/api/v2/population/labour?province_code=aousserd");
    assert.equal(unknown.statusCode, 200);
    assert.equal(unknown.json().meta.total, 0);
  });

  it("publishes unpublished rates as null", async () => {
    const assaZag = (await app.inject("/api/v2/population/labour?province_code=assa-zag&year=2018")).json().data[0];
    assert.deepEqual([assaZag.activity_rate, assaZag.employment_rate, assaZag.unemployment_rate], [35.9, null, null]);
  });

  it("mirrors the route under /api/v1", async () => {
    const v1 = await app.inject("/api/v1/population/labour?province_code=al-hoceima");
    assert.equal(v1.statusCode, 200);
    assert.equal(v1.headers.link, '</api/v2/population/labour?province_code=al-hoceima>; rel="successor-version"');
    assert.deepEqual(v1.json(), (await app.inject("/api/v2/population/labour?province_code=al-hoceima")).json());
  });

  it("rejects invalid filters", async () => {
    for (const url of [
      "/api/v2/population/labour?area=suburb",
      "/api/v2/population/labour?year=1999",
      "/api/v2/population/labour?year=2025.5",
      "/api/v2/population/labour?from=2101",
      "/api/v2/population/labour?from=2024&to=2020",
      "/api/v2/population/labour?province_code=Al%20Hoceima",
      "/api/v2/population/labour?level=regions",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR", url);
    }
    assert.equal((await app.inject("/api/v2/population/labour?from=2024&to=2020")).json().error.message, "from must not be after to");
  });

  it("documents the route in OpenAPI under Population", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const operation = spec.paths["/api/v2/population/labour"]?.get;
    assert.deepEqual(operation?.tags, ["Population"]);
    assert.match(operation.description, /National Employment Survey/);
    assert.match(operation.description, /RGPH 2024 census/);
    assert.deepEqual(
      operation.parameters.map((parameter: { name: string }) => parameter.name).sort(),
      ["area", "from", "limit", "offset", "province_code", "region_code", "to", "year"],
    );
    assert.equal(spec.paths["/api/v1/population/labour"], undefined);
  });
});
