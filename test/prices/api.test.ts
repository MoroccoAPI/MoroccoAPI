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

interface Observation {
  city_code: string;
  product_code: string;
  product_name: string;
  level: string;
  month: string;
  index: number;
}

const expectValidation = async (url: string, message: RegExp) => {
  const response = await app.inject(url);
  assert.equal(response.statusCode, 400, url);
  assert.equal(response.json().error.code, "VALIDATION_ERROR", url);
  assert.match(response.json().error.message, message, url);
};

describe("prices/cpi", () => {
  it("returns one series oldest first with its metadata", async () => {
    const response = await app.inject("/api/v2/prices/cpi?city=national&product=GR&from=2026-06");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual(body.data, [
      { city_code: "national", product_code: "GR", product_name: "GENERAL", level: "general", month: "2026-06", index: 119.9 },
      { city_code: "national", product_code: "GR", product_name: "GENERAL", level: "general", month: "2026-07", index: 118.7 },
      { city_code: "national", product_code: "GR", product_name: "GENERAL", level: "general", month: "2026-08", index: 119.6 },
    ]);
    assert.equal(body.meta.dataset, "prices-cpi");
    assert.equal(body.meta.total, 3);
    assert.equal(body.meta.license, "ODbL-1.0");
    assert.equal(body.meta.sources[0].producer, "Haut-Commissariat au Plan (HCP)");
    assert.equal(body.meta.sources[0].source_updated_at, "2026-10-30");
    assert.deepEqual(body.meta.pagination, { limit: 100, offset: 0, count: 3, has_more: false, next_offset: null });
  });

  it("pages through a whole city ordered by product and month", async () => {
    const all = await collectAllPages<Observation>(app, "/api/v2/prices/cpi?city=dakhla");
    assert.equal(all.data.length, 130 * 116);
    assert.equal(all.meta.total, 130 * 116);
    assert.ok(all.data.every((row) => row.city_code === "dakhla"));
    assert.deepEqual(all.data.slice(0, 2).map((row) => [row.product_code, row.month]), [["GR", "2017-01"], ["GR", "2017-02"]]);
    assert.deepEqual(all.data.slice(115, 117).map((row) => [row.product_code, row.month]), [["GR", "2026-08"], ["01", "2017-01"]]);
    assert.ok(!all.data.some((row) => row.product_code === "021"));
  });

  it("compares cities for one product and month, and filters by level", async () => {
    const food = await app.inject("/api/v2/prices/cpi?product=01&from=2026-08&to=2026-08");
    const rows: Observation[] = food.json().data;
    assert.equal(rows.length, 19);
    assert.equal(rows[0]!.city_code, "national");
    assert.equal(rows[0]!.index, 125.8);
    assert.ok(rows.every((row) => row.product_code === "01" && row.month === "2026-08"));

    const divisions = await app.inject("/api/v2/prices/cpi?city=rabat&level=division&from=2026-08");
    const divisionRows: Observation[] = divisions.json().data;
    assert.equal(divisionRows.length, 12);
    assert.ok(divisionRows.every((row) => row.level === "division" && row.product_code.length === 2));

    const none = await app.inject("/api/v2/prices/cpi?product=GR&level=class");
    assert.equal(none.json().meta.total, 0);
  });

  it("returns an empty page for a series HCP does not publish or months outside the coverage", async () => {
    for (const url of [
      "/api/v2/prices/cpi?city=dakhla&product=021",
      "/api/v2/prices/cpi?city=national&from=2026-09",
      "/api/v2/prices/cpi?city=national&to=2016-12",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 200, url);
      assert.deepEqual(response.json().data, [], url);
      assert.equal(response.json().meta.total, 0, url);
    }
  });

  it("rejects requests without city or product, reversed ranges and invalid values", async () => {
    await expectValidation("/api/v2/prices/cpi", /Provide city, product or both/);
    await expectValidation("/api/v2/prices/cpi?level=class", /Provide city, product or both/);
    await expectValidation("/api/v2/prices/cpi?city=fes&from=2026-05&to=2026-01", /from must not be after to/);
    for (const query of ["city=paris", "city=Fes", "product=gr", "product=0199", "level=family", "city=fes&from=2026-13",
      "city=fes&to=2026-1", "city=fes&from=2026", "city=fes&month=2026-01"]) {
      await expectValidation(`/api/v2/prices/cpi?${query}`, /./);
    }
  });

  it("lists the product nomenclature with parents and city coverage", async () => {
    const all = await collectAllPages<{ code: string; level: string; parent_code: string | null; city_count: number }>(
      app, "/api/v2/prices/cpi/products");
    assert.equal(all.data.length, 148);
    assert.deepEqual(all.data.slice(0, 4).map((product) => product.code), ["GR", "01", "011", "0111"]);
    assert.ok(all.data.every((product) => product.parent_code === null || all.data.some((parent) => parent.code === product.parent_code)));

    const classes = await app.inject("/api/v2/prices/cpi/products?level=class&limit=500");
    assert.equal(classes.json().meta.total, 92);
    const groups = await app.inject("/api/v2/prices/cpi/products?level=group&limit=1");
    assert.deepEqual(groups.json().data, [
      { code: "011", name: "PRODUITS ALIMENTAIRES", level: "group", parent_code: "01", city_count: 18 },
    ]);
    await expectValidation("/api/v2/prices/cpi/products?level=family", /./);
  });

  it("lists the national index and the 18 cities with their regions", async () => {
    const response = await app.inject("/api/v2/prices/cpi/cities");
    assert.equal(response.statusCode, 200);
    const cities = response.json().data;
    assert.equal(cities.length, 19);
    assert.deepEqual(cities[0], {
      code: "national", name: "National", region_code: null, product_count: 148, first_month: "2017-01", last_month: "2026-08",
    });
    assert.deepEqual(cities.find((city: { code: string }) => city.code === "fes"), {
      code: "fes", name: "Fès", region_code: "fes-meknes", product_count: 148, first_month: "2017-01", last_month: "2026-08",
    });
    assert.equal(response.json().meta.total, 19);
  });

  it("keeps the v1 compatibility alias and publishes the v2 paths in OpenAPI", async () => {
    const legacy = await app.inject("/api/v1/prices/cpi?city=rabat&product=GR&from=2026-08");
    assert.equal(legacy.statusCode, 200);
    assert.equal(legacy.headers.link, '</api/v2/prices/cpi?city=rabat&product=GR&from=2026-08>; rel="successor-version"');
    assert.equal(legacy.json().data[0].index, (await app.inject("/api/v2/prices/cpi?city=rabat&product=GR&from=2026-08")).json().data[0].index);
    const spec = (await app.inject("/openapi.json")).json();
    for (const path of ["/api/v2/prices/cpi", "/api/v2/prices/cpi/products", "/api/v2/prices/cpi/cities"]) {
      assert.deepEqual(spec.paths[path].get.tags, ["Prices"], path);
    }
    assert.equal(spec.paths["/api/v1/prices/cpi"], undefined);
  });
});
