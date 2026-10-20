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

describe("population/indicators", () => {
  it("lists all indicators with bounded pagination and metadata", async () => {
    const first = await app.inject("/api/v2/population/indicators?limit=2");
    assert.equal(first.statusCode, 200);
    const firstBody = first.json();
    assert.equal(firstBody.data.length, 2);
    assert.equal(firstBody.meta.dataset, "population-indicators");
    assert.equal(firstBody.meta.total, 98);
    assert.deepEqual(firstBody.meta.pagination, {
      limit: 2, offset: 0, count: 2, has_more: true, next_offset: 2,
    });
    assert.equal(firstBody.meta.license, "CC-BY-4.0");
    assert.equal(firstBody.meta.retrieved_at, "2026-10-20");
    assert.equal(firstBody.meta.transformation_version, "1.0.0");
    assert.equal(firstBody.meta.sources.length, 1);
    assert.equal(firstBody.meta.sources[0].producer, "Haut-Commissariat au Plan (HCP)");

    const all = await collectAllPages<{ id: string; group: string }>(app, "/api/v2/population/indicators");
    assert.equal(all.data.length, 98);
    assert.equal(new Set(all.data.map((indicator) => indicator.id)).size, 98);
  });

  it("filters the catalogue by group and accent-insensitive multilingual text", async () => {
    const group = await app.inject("/api/v2/population/indicators?group=languages&limit=500");
    assert.equal(group.statusCode, 200);
    assert.ok(group.json().data.length > 0);
    assert.ok(group.json().data.every((indicator: { group: string }) => indicator.group === "languages"));

    const french = await app.inject("/api/v2/population/indicators?q=chomage");
    assert.equal(french.statusCode, 200);
    assert.deepEqual(french.json().data.map((indicator: { id: string }) => indicator.id), ["unemployment-rate"]);

    const arabic = await app.inject("/api/v2/population/indicators?q=البطالة");
    assert.equal(arabic.statusCode, 200);
    assert.deepEqual(arabic.json().data.map((indicator: { id: string }) => indicator.id), ["unemployment-rate"]);
  });

  it("returns one indicator across a selected level with geographic filters", async () => {
    const regions = await app.inject("/api/v2/population/indicators/unemployment-rate?level=regions&limit=1");
    assert.equal(regions.statusCode, 200);
    assert.equal(regions.json().meta.total, 12);
    assert.equal(regions.json().data.length, 1);
    assert.equal(regions.json().data[0].level, "regions");
    assert.equal(regions.json().data[0].null_reasons.both_sexes, null);

    const provinces = await app.inject(
      "/api/v2/population/indicators/unemployment-rate?level=subdivisions&region_code=rabat-sale-kenitra&limit=500",
    );
    assert.equal(provinces.statusCode, 200);
    assert.ok(provinces.json().meta.total > 0);
    assert.ok(provinces.json().data.every((record: { region_code: string }) => record.region_code === "rabat-sale-kenitra"));

    const communes = await app.inject(
      "/api/v2/population/indicators/unemployment-rate?level=communes&province_code=rabat&limit=2",
    );
    assert.equal(communes.statusCode, 200);
    assert.ok(communes.json().data.length <= 2);
    assert.ok(communes.json().meta.total >= communes.json().data.length);
    assert.ok(communes.json().data.every((record: { province_code: string }) => record.province_code === "rabat"));
  });

  it("returns national and territory profiles without colliding with existing population routes", async () => {
    const national = await app.inject("/api/v2/population/national/indicators?group=disability");
    assert.equal(national.statusCode, 200);
    assert.equal(national.json().data.territory.level, "national");
    assert.ok(national.json().data.indicators.length > 0);
    assert.ok(national.json().data.indicators.every((indicator: { group: string }) => indicator.group === "disability"));

    const regionList = await app.inject("/api/v2/regions?limit=1");
    const regionCode = regionList.json().data[0].code;
    const region = await app.inject(`/api/v2/population/regions/${regionCode}/indicators`);
    assert.equal(region.statusCode, 200);
    assert.equal(region.json().data.territory.code, regionCode);
    assert.equal(region.json().data.territory.level, "regions");
    assert.equal(region.json().data.indicators.length, 98);

    const communeList = await app.inject("/api/v2/communes?limit=1");
    const communeCode = communeList.json().data[0].code;
    const commune = await app.inject(`/api/v2/population/communes/${communeCode}/indicators?group=employment`);
    assert.equal(commune.statusCode, 200);
    assert.equal(commune.json().data.territory.code, communeCode);
    assert.ok(commune.json().data.indicators.every((indicator: { group: string }) => indicator.group === "employment"));

    const existingPopulationRoute = await app.inject(`/api/v2/population/communes/${communeCode}`);
    assert.equal(existingPopulationRoute.statusCode, 200);
    assert.equal(existingPopulationRoute.json().meta.dataset, "commune-population");
  });

  it("mirrors indicator profiles on v1 with the deprecation headers", async () => {
    const code = (await app.inject("/api/v2/regions?limit=1")).json().data[0].code;
    const v2 = await app.inject(`/api/v2/population/regions/${code}/indicators`);
    const v1 = await app.inject(`/api/v1/population/regions/${code}/indicators`);
    assert.equal(v2.statusCode, 200);
    assert.equal(v1.statusCode, 200);
    assert.deepEqual(v1.json(), v2.json());
    assert.match(String(v1.headers["x-moroccoapi-deprecated"]), /Use \/api\/v2/);
    assert.match(String(v1.headers.link), /rel="successor-version"/);
  });

  it("returns stable validation and not-found errors", async () => {
    for (const url of [
      "/api/v2/population/indicators?q=x",
      "/api/v2/population/indicators?group=unknown",
      "/api/v2/population/indicators/unemployment-rate?level=unknown",
      "/api/v2/population/indicators/no-such-indicator",
      "/api/v2/population/regions/not-a-region/indicators",
    ]) {
      const response = await app.inject(url);
      assert.ok(response.statusCode === 400 || response.statusCode === 404, url);
      const body = response.json();
      assert.deepEqual(Object.keys(body), ["error"], url);
      assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "request_id"], url);
      assert.equal(typeof body.error.request_id, "string", url);
    }
    assert.equal((await app.inject("/api/v2/population/indicators/no-such-indicator")).json().error.code, "RESOURCE_NOT_FOUND");
    assert.equal((await app.inject("/api/v2/population/regions/not-a-region/indicators")).json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("publishes every indicator path and the Population tag in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    assert.equal(response.statusCode, 200);
    const spec = response.json();
    for (const path of [
      "/api/v2/population/indicators",
      "/api/v2/population/indicators/{id}",
      "/api/v2/population/national/indicators",
      "/api/v2/population/{level}/{code}/indicators",
    ]) {
      assert.ok(spec.paths[path]?.get, path);
      assert.deepEqual(spec.paths[path].get.tags, ["Population"], path);
    }
  });
});
