import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import type { Indicator, IndicatorSummary, Topic } from "../../src/world-bank/types.js";
import { collectAllPages } from "../helpers/pagination.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

const get = async (url: string) => {
  const response = await app.inject(url);
  return { status: response.statusCode, body: response.json() };
};

describe("world-bank/catalogue", () => {
  it("lists every published indicator without values or attribution detail", async () => {
    const { status, body: firstPage } = await get("/api/v1/world-bank/indicators");
    assert.equal(status, 200);
    assert.equal(firstPage.data.length, 100);
    assert.equal(firstPage.meta.total, 1362);
    assert.deepEqual(firstPage.meta.pagination, {
      limit: 100, offset: 0, count: 100, has_more: true, next_offset: 100,
    });
    const body = await collectAllPages<IndicatorSummary>(app, "/api/v1/world-bank/indicators");
    assert.equal(body.data.length, 1362);
    assert.equal(body.meta.total, 1362);
    assert.equal(new Set(body.data.map((indicator) => indicator.code)).size, 1362);
    assert.deepEqual(firstPage.data, body.data.slice(0, 100));
    assert.deepEqual(Object.keys(body.data[0]).sort(), [
      "code", "first_year", "last_year", "license", "name", "periodicity", "topic", "topic_code", "unit", "value_count",
    ]);
  });

  it("filters by topic and searches codes and names without case or accents", async () => {
    const topic = await get("/api/v1/world-bank/indicators?topic=infrastructure");
    assert.equal(topic.body.data.length, 36);
    assert.ok(topic.body.data.every((indicator: IndicatorSummary) => indicator.topic_code === "infrastructure"));
    const search = await get("/api/v1/world-bank/indicators?q=INTERNET");
    assert.ok(search.body.data.some((indicator: IndicatorSummary) => indicator.code === "IT.NET.USER.ZS"));
    const code = await get("/api/v1/world-bank/indicators?q=ny.gdp.mktp");
    assert.ok(code.body.data.every((indicator: IndicatorSummary) => indicator.code.startsWith("NY.GDP.MKTP")));
    const none = await get("/api/v1/world-bank/indicators?topic=health&q=internet");
    assert.deepEqual(none.body.data, []);
  });

  it("rejects unknown topics and too-short queries", async () => {
    for (const url of ["/api/v1/world-bank/indicators?topic=nope", "/api/v1/world-bank/indicators?q=a", "/api/v1/world-bank/indicators?q=%20%20a"]) {
      const { status, body } = await get(url);
      assert.equal(status, 400, url);
      assert.equal(body.error.code, "VALIDATION_ERROR", url);
    }
  });

  it("lists the 13 topics with counts matching the catalogue", async () => {
    const { body } = await get("/api/v1/world-bank/indicators/topics");
    assert.equal(body.data.length, 13);
    assert.deepEqual(body.meta.pagination, {
      limit: 100, offset: 0, count: 13, has_more: false, next_offset: null,
    });
    const health = body.data.find((topic: Topic) => topic.code === "health");
    const catalogue = await collectAllPages<IndicatorSummary>(app, "/api/v1/world-bank/indicators?topic=health");
    assert.equal(health.indicator_count, catalogue.data.length);
  });

  it("filters the catalogue before paging and retains the matching total", async () => {
    const url = "/api/v1/world-bank/indicators?topic=infrastructure&q=internet";
    const complete = await collectAllPages<IndicatorSummary>(app, url);
    assert.ok(complete.data.length > 1);
    const { status, body } = await get(`${url}&limit=1&offset=1`);
    assert.equal(status, 200);
    assert.deepEqual(body.data, complete.data.slice(1, 2));
    assert.equal(body.meta.total, complete.data.length);
    assert.deepEqual(body.meta.pagination, {
      limit: 1, offset: 1, count: 1,
      has_more: complete.data.length > 2,
      next_offset: complete.data.length > 2 ? 2 : null,
    });
  });

  it("pages topics in stable order and returns an empty page beyond the end", async () => {
    const url = "/api/v1/world-bank/indicators/topics";
    const complete = await collectAllPages<Topic>(app, url);
    const page = await get(`${url}?limit=3&offset=2`);
    assert.equal(page.status, 200);
    assert.deepEqual(page.body.data, complete.data.slice(2, 5));
    assert.equal(page.body.meta.total, 13);
    assert.deepEqual(page.body.meta.pagination, {
      limit: 3, offset: 2, count: 3, has_more: true, next_offset: 5,
    });
    const end = await get(`${url}?offset=2147483647`);
    assert.equal(end.status, 200);
    assert.deepEqual(end.body.data, []);
    assert.equal(end.body.meta.total, 13);
    assert.deepEqual(end.body.meta.pagination, {
      limit: 100, offset: 2_147_483_647, count: 0, has_more: false, next_offset: null,
    });
  });

  it("rejects invalid pagination on both World Bank collections", async () => {
    for (const path of ["/api/v1/world-bank/indicators", "/api/v1/world-bank/indicators/topics"]) {
      for (const query of ["limit=501", "limit=Infinity", "offset=-1", "offset=1e309"]) {
        const { status, body } = await get(`${path}?${query}`);
        assert.equal(status, 400, `${path}?${query}`);
        assert.equal(body.error.code, "VALIDATION_ERROR");
      }
    }
  });
});

describe("world-bank/indicator", () => {
  it("returns one indicator with attribution and values, in any letter case", async () => {
    const { status, body } = await get("/api/v1/world-bank/indicators/it.net.user.zs");
    assert.equal(status, 200);
    const indicator: Indicator = body.data;
    assert.equal(indicator.code, "IT.NET.USER.ZS");
    assert.match(indicator.citation_note ?? "", /International Telecommunication Union/);
    assert.equal(indicator.values.length, indicator.value_count);
    assert.equal(body.meta.total, 1);
    // Some World Bank codes are lowercase; they are matched case-insensitively too.
    for (const code of ["per_allsp.cov_pop_tot", "PER_ALLSP.COV_POP_TOT"]) {
      const lowercase = await get(`/api/v1/world-bank/indicators/${code}`);
      assert.equal(lowercase.status, 200, code);
      assert.equal(lowercase.body.data.code, "per_allsp.cov_pop_tot");
    }
  });

  it("selects an inclusive range of years", async () => {
    const { body } = await get("/api/v1/world-bank/indicators/IT.NET.USER.ZS?from=2022&to=2024");
    assert.deepEqual(body.data.values, [{ year: 2022, value: 89.9 }, { year: 2023, value: 91 }, { year: 2024, value: 91.2 }]);
    assert.equal(body.data.value_count, 31, "value_count describes the whole series");
    const empty = await get("/api/v1/world-bank/indicators/IT.NET.USER.ZS?from=1960&to=1980");
    assert.deepEqual(empty.body.data.values, []);
  });

  it("rejects non-finite and out-of-range bounds before filtering values", async () => {
    for (const parameter of ["from", "to"]) {
      for (const value of ["Infinity", "-Infinity", "+Infinity", "1e309", "-1e309", "NaN", "9007199254740992", "1960.5", "1959", "2101"]) {
        const url = `/api/v1/world-bank/indicators/IT.NET.USER.ZS?${new URLSearchParams({ [parameter]: value })}`;
        const { status, body } = await get(url);
        assert.equal(status, 400, url);
        assert.deepEqual(Object.keys(body), ["error"], url);
        assert.deepEqual(Object.keys(body.error).sort(), ["code", "message", "request_id"], url);
        assert.equal(body.error.code, "VALIDATION_ERROR", url);
        assert.equal(typeof body.error.message, "string", url);
        assert.ok(body.error.message.length > 0, url);
        assert.equal(typeof body.error.request_id, "string", url);
        assert.ok(body.error.request_id.length > 0, url);
      }
    }
  });

  it("retains inclusive finite bounds and numeric coercion for indicator details", async () => {
    const url = "/api/v1/world-bank/indicators/IT.NET.USER.ZS";
    const whole = await get(url);
    const bounded = await get(`${url}?from=1960&to=2100`);
    assert.equal(whole.status, 200);
    assert.equal(bounded.status, 200);
    assert.deepEqual(bounded.body, whole.body);
    const ordinary = await get(`${url}?from=2022&to=2024`);
    const numericNotation = await get(`${url}?from=2.022e3&to=2024.0`);
    assert.equal(numericNotation.status, 200);
    assert.deepEqual(numericNotation.body, ordinary.body);
    assert.ok(!Object.hasOwn(whole.body.meta, "pagination"));
  });

  it("explains why an excluded indicator is not published", async () => {
    const { status, body } = await get("/api/v1/world-bank/indicators/MS.MIL.XPND.GD.ZS");
    assert.equal(status, 404);
    assert.equal(body.error.code, "RESOURCE_NOT_FOUND");
    assert.match(body.error.message, /license \(SIPRI terms and conditions\) is not CC BY 4.0/);
  });

  it("returns errors for unknown codes, invalid codes and reversed ranges", async () => {
    const missing = await get("/api/v1/world-bank/indicators/NOPE.CODE");
    assert.equal(missing.status, 404);
    assert.match(missing.body.error.message, /No World Bank indicator with Moroccan data/);
    for (const url of [
      "/api/v1/world-bank/indicators/bad%20code",
      "/api/v1/world-bank/indicators/IT.NET.USER.ZS?from=2024&to=2020",
      "/api/v1/world-bank/indicators/IT.NET.USER.ZS?from=1900",
    ]) {
      const { status, body } = await get(url);
      assert.equal(status, 400, url);
      assert.equal(body.error.code, "VALIDATION_ERROR", url);
    }
  });

  it("uses the shared metadata envelope and documents the paths and estimates in OpenAPI", async () => {
    const worldBank = (await get("/api/v1/world-bank/indicators/topics")).body.meta;
    const geography = (await get("/api/v1/regions")).body.meta;
    assert.deepEqual(Object.keys(worldBank).sort(), Object.keys(geography).sort());
    assert.equal(worldBank.license, "CC-BY-4.0");
    const spec = (await get("/openapi.json")).body;
    for (const path of ["/api/v1/world-bank/indicators", "/api/v1/world-bank/indicators/topics", "/api/v1/world-bank/indicators/{code}"]) {
      assert.ok(spec.paths[path]?.get, path);
    }
    assert.match(spec.paths["/api/v1/world-bank/indicators/{code}"].get.description, /differ from Moroccan official statistics/);
    assert.ok(spec.tags.some((tag: { name: string }) => tag.name === "World Bank"));
  });
});
