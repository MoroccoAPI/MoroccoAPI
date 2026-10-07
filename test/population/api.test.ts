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

describe("population/national", () => {
  it("returns the national population breakdown with source metadata", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/population/national",
    });

    assert.equal(response.statusCode, 200);

    const body = response.json();
    const { data } = body;
    for (const breakdown of [data, data.urban, data.rural]) {
      assert.ok(Number.isSafeInteger(breakdown.total));
      assert.ok(Number.isSafeInteger(breakdown.moroccans));
      assert.ok(Number.isSafeInteger(breakdown.foreigners));
      assert.ok(breakdown.total >= 0);
      assert.ok(breakdown.moroccans >= 0);
      assert.ok(breakdown.foreigners >= 0);
      assert.equal(breakdown.moroccans + breakdown.foreigners, breakdown.total);
    }
    assert.equal(data.urban.total + data.rural.total, data.total);
    assert.equal(data.urban.moroccans + data.rural.moroccans, data.moroccans);
    assert.equal(data.urban.foreigners + data.rural.foreigners, data.foreigners);
    assert.equal(body.meta.dataset, "national-population");
    assert.equal(body.meta.total, 1);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(body.meta.retrieved_at, "2026-10-05");
    assert.equal(body.meta.transformation_version, "2.0.0");
    assert.equal(body.meta.sources.length, 2);

    for (const source of body.meta.sources) {
      assert.equal(source.producer, "Haut-Commissariat au Plan (HCP)");
      assert.equal(source.license, "CC-BY-4.0");
      assert.ok(source.source_url.startsWith("https://"));
      assert.ok(source.resource_url.startsWith("https://"));
    }
  });

  it("publishes the endpoint in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    assert.equal(response.statusCode, 200);

    const operation = response.json().paths["/api/v1/population/national"]?.get;
    assert.ok(operation);
    assert.equal(operation.tags[0], "Population");
    assert.ok(operation.responses["200"]);
  });
});

describe("population/regions", () => {
  it("returns regional population records with totals matching the national endpoint", async () => {
    const [regionsResponse, nationalResponse] = await Promise.all([
      app.inject("/api/v1/population/regions"),
      app.inject("/api/v1/population/national"),
    ]);
    assert.equal(regionsResponse.statusCode, 200);
    assert.equal(nationalResponse.statusCode, 200);

    const body = regionsResponse.json();
    const regions = body.data;
    assert.equal(regions.length, 12);
    assert.equal(body.meta.dataset, "regional-population");
    assert.equal(body.meta.total, regions.length);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(new Set(regions.map((region: { code: string }) => region.code)).size, regions.length);

    for (const region of regions) {
      assert.equal(region.type, "region");
      assert.ok(region.name.ar);
      assert.ok(region.name.fr);
      assert.ok(region.name.en);
      for (const field of ["population", "moroccans", "foreigners", "urban", "rural"] as const) {
        assert.ok(Number.isSafeInteger(region[field]));
        assert.ok(region[field] >= 0);
      }
      assert.equal(region.moroccans + region.foreigners, region.population);
      assert.equal(region.urban + region.rural, region.population);
    }

    const totals = regions.reduce(
      (sum: Record<string, number>, region: Record<string, number>) => {
        for (const field of ["population", "moroccans", "foreigners", "urban", "rural"]) {
          sum[field] += region[field];
        }
        return sum;
      },
      { population: 0, moroccans: 0, foreigners: 0, urban: 0, rural: 0 },
    );
    const national = nationalResponse.json().data;
    assert.equal(totals.population, national.total);
    assert.equal(totals.moroccans, national.moroccans);
    assert.equal(totals.foreigners, national.foreigners);
    assert.equal(totals.urban, national.urban.total);
    assert.equal(totals.rural, national.rural.total);
  });

  it("returns one region by MoroccoAPI code and a not-found error for unknown codes", async () => {
    const list = await app.inject("/api/v1/population/regions");
    const firstCode = list.json().data[0].code;
    const detail = await app.inject(`/api/v1/population/regions/${firstCode}`);
    assert.equal(detail.statusCode, 200);
    assert.equal(detail.json().data.code, firstCode);
    assert.equal(detail.json().meta.total, 1);

    const missing = await app.inject("/api/v1/population/regions/not-a-region");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("publishes regional population endpoints in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    const paths = response.json().paths;
    assert.ok(paths["/api/v1/population/regions"]?.get);
    assert.ok(paths["/api/v1/population/regions/{code}"]?.get);
  });
});
describe("population/historical", () => {
  it("returns historical population records with totals matching the national endpoint", async () => {
    const [historicalResponse, nationalResponse] = await Promise.all([
      app.inject("/api/v1/population/historical"),
      app.inject("/api/v1/population/national"),
    ]);
    assert.equal(historicalResponse.statusCode, 200);
    assert.equal(nationalResponse.statusCode, 200);

    const body = historicalResponse.json();
    const historical = body.data;
    assert.ok(historical.length > 0);
    assert.equal(body.meta.dataset, "historical-population");
    assert.equal(body.meta.total, historical.length);
    assert.equal(body.meta.license, "CC-BY-4.0");

    const years = historical.map((record: { year: number }) => record.year);
    assert.equal(new Set(years).size, years.length);
    assert.deepEqual(years, [...years].sort((a: number, b: number) => a - b));

    for (const record of historical) {
      assert.ok(Number.isSafeInteger(record.year));
      assert.ok(Number.isSafeInteger(record.total));
      assert.ok(Number.isSafeInteger(record.urban));
      assert.ok(Number.isSafeInteger(record.rural));
      assert.ok(record.total >= 0);
      assert.ok(record.urban >= 0);
      assert.ok(record.rural >= 0);
      assert.equal(record.urban + record.rural, record.total);
    }

    const latest = historical[historical.length - 1];
    const national = nationalResponse.json().data;
    assert.equal(latest.total, national.total);
    assert.equal(latest.urban, national.urban.total);
    assert.equal(latest.rural, national.rural.total);
  });

  it("publishes historical population endpoints in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    const paths = response.json().paths;
    assert.ok(paths["/api/v1/population/historical"]?.get);
    assert.ok(paths["/api/v1/population/historical/{year}"]?.get);
  });

  it("returns one census year and reports an unsupported year as not found", async () => {
    const listResponse = await app.inject("/api/v1/population/historical");
    const history = listResponse.json().data;
    const firstRecord = history[0];

    const detailResponse = await app.inject(
      `/api/v1/population/historical/${firstRecord.year}`,
    );
    assert.equal(detailResponse.statusCode, 200);
    assert.deepEqual(detailResponse.json().data, firstRecord);
    assert.equal(detailResponse.json().meta.total, 1);

    const yearSet = new Set(history.map((record: { year: number }) => record.year));
    const unsupportedYear = Array.from({ length: 2024 - 1960 + 1 }, (_, index) => 1960 + index)
      .find((year) => !yearSet.has(year));
    assert.ok(unsupportedYear, "Expected at least one unsupported census year in the supported range");

    const missingResponse = await app.inject(
      `/api/v1/population/historical/${unsupportedYear}`,
    );
    assert.equal(missingResponse.statusCode, 404);
    assert.equal(missingResponse.json().error.code, "RESOURCE_NOT_FOUND");
  });
});

describe("population/provinces", () => {
  it("returns population records whose totals match the national endpoint", async () => {
    const [provincesResponse, nationalResponse] = await Promise.all([
      app.inject("/api/v1/population/subdivisions"),
      app.inject("/api/v1/population/national"),
    ]);
    assert.equal(provincesResponse.statusCode, 200);
    assert.equal(nationalResponse.statusCode, 200);

    const body = provincesResponse.json();
    const provinces = body.data;
    assert.equal(provinces.length, 75);
    assert.equal(body.meta.dataset, "subdivision-population");
    assert.equal(body.meta.total, provinces.length);
    assert.equal(new Set(provinces.map((item: { hcp_code: string }) => item.hcp_code)).size, provinces.length);

    const totals = provinces.reduce(
      (sum: Record<string, number>, item: Record<string, number>) => {
        for (const field of ["population", "moroccans", "foreigners", "households"]) {
          assert.ok(Number.isSafeInteger(item[field]));
          assert.ok(item[field] >= 0);
          sum[field] += item[field];
        }
        assert.equal(item.moroccans + item.foreigners, item.population);
        return sum;
      },
      { population: 0, moroccans: 0, foreigners: 0, households: 0 },
    );
    const national = nationalResponse.json().data;
    assert.equal(totals.population, national.total);
    assert.equal(totals.moroccans, national.moroccans);
    assert.equal(totals.foreigners, national.foreigners);
  });

  it("returns one province or prefecture by MoroccoAPI code", async () => {
    const listResponse = await app.inject("/api/v1/population/subdivisions");
    const first = listResponse.json().data[0];
    const detailResponse = await app.inject(`/api/v1/population/subdivisions/${first.code}`);
    assert.equal(detailResponse.statusCode, 200);
    assert.deepEqual(detailResponse.json().data, first);
    assert.equal(detailResponse.json().meta.total, 1);

    const missingResponse = await app.inject("/api/v1/population/subdivisions/not-a-province");
    assert.equal(missingResponse.statusCode, 404);
    assert.equal(missingResponse.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("publishes province and prefecture population endpoints in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    const paths = response.json().paths;
    assert.ok(paths["/api/v1/population/subdivisions"]?.get);
    assert.ok(paths["/api/v1/population/subdivisions/{code}"]?.get);
  });
});

describe("population/communes", () => {
  it("returns commune population records whose totals match national and subdivision data", async () => {
    const [communesResponse, nationalResponse, provincesResponse] = await Promise.all([
      app.inject("/api/v1/population/communes"),
      app.inject("/api/v1/population/national"),
      app.inject("/api/v1/population/subdivisions"),
    ]);
    assert.equal(communesResponse.statusCode, 200);
    assert.equal(nationalResponse.statusCode, 200);
    assert.equal(provincesResponse.statusCode, 200);

    const body = communesResponse.json();
    const communes = body.data;
    assert.equal(communes.length, 1503);
    assert.equal(body.meta.dataset, "commune-population");
    assert.equal(body.meta.total, communes.length);
    assert.equal(new Set(communes.map((item: { code: string }) => item.code)).size, communes.length);

    const totals = communes.reduce(
      (sum: Record<string, number>, item: Record<string, number>) => {
        for (const field of ["population", "moroccans", "foreigners", "households"]) {
          assert.ok(Number.isSafeInteger(item[field]));
          assert.ok(item[field] >= 0);
          sum[field] += item[field];
        }
        assert.equal(item.moroccans + item.foreigners, item.population);
        return sum;
      },
      { population: 0, moroccans: 0, foreigners: 0, households: 0 },
    );
    const national = nationalResponse.json().data;
    assert.equal(totals.population, national.total);
    assert.equal(totals.moroccans, national.moroccans);
    assert.equal(totals.foreigners, national.foreigners);

    const subdivisionHouseholds = provincesResponse.json().data.reduce(
      (sum: number, item: { households: number }) => sum + item.households,
      0,
    );
    assert.equal(totals.households, subdivisionHouseholds);
  });

  it("returns a commune by MoroccoAPI code and a not-found error for unknown codes", async () => {
    const listResponse = await app.inject("/api/v1/population/communes");
    const first = listResponse.json().data[0];
    const detailResponse = await app.inject(`/api/v1/population/communes/${first.code}`);
    assert.equal(detailResponse.statusCode, 200);
    assert.deepEqual(detailResponse.json().data, first);
    assert.equal(detailResponse.json().meta.total, 1);

    const missingResponse = await app.inject("/api/v1/population/communes/not-a-commune");
    assert.equal(missingResponse.statusCode, 404);
    assert.equal(missingResponse.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("publishes commune population endpoints in OpenAPI", async () => {
    const response = await app.inject("/openapi.json");
    const paths = response.json().paths;
    assert.ok(paths["/api/v1/population/communes"]?.get);
    assert.ok(paths["/api/v1/population/communes/{code}"]?.get);
  });
});
