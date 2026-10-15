import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadEducationSchools } from "../../src/education/data/schools.js";
import { loadUniversityEstablishments } from "../../src/education/data/universities.js";
import { buildEducationMeta } from "../../src/education/metadata.js";
import { schoolDatasetRoutes } from "../../src/education/types.js";
import { loadRegions } from "../../src/geography/data/regions.js";
import { loadGeography } from "../../src/geography/data/subdivisions.js";
import { loadHospitals } from "../../src/health/data/hospitals.js";
import { loadPrimaryCareFacilities } from "../../src/health/data/primary-care-facilities.js";
import { loadPrivateInfrastructure } from "../../src/health/data/private-infrastructure.js";
import { buildDatasetMeta } from "../../src/health/metadata.js";
import { collectAllPages } from "../helpers/pagination.js";

interface Fixture {
  records: readonly unknown[];
  meta: unknown;
  filters: Record<string, string>;
  filtered: readonly unknown[];
}

interface Collection {
  data: unknown[];
  meta: {
    total: number;
    pagination: {
      limit: number;
      offset: number;
      count: number;
      has_more: boolean;
      next_offset: number | null;
    };
  };
}

const paths = [
  ...schoolDatasetRoutes.map(({ path }) => `/api/v1/education/${path}`),
  "/api/v1/education/universites-publiques",
  "/api/v1/health/hospitals",
  "/api/v1/health/primary-care-facilities",
  "/api/v1/health/private-infrastructure",
];
const fixtures = new Map<string, Fixture>();
let app: FastifyInstance;

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").toLocaleLowerCase("fr").trim();
}

before(async () => {
  const regions = await loadRegions();
  const geography = { regions, ...await loadGeography(regions) };
  const [schools, universities, hospitals, primaryCare, infrastructure] = await Promise.all([
    loadEducationSchools(),
    loadUniversityEstablishments(),
    loadHospitals(regions, geography),
    loadPrimaryCareFacilities(regions, geography),
    loadPrivateInfrastructure(regions),
  ]);
  for (const config of schoolDatasetRoutes) {
    const records = schools.filter((row) => row.category === config.category);
    const region = records.at(-1)!.region;
    fixtures.set(`/api/v1/education/${config.path}`, {
      records,
      meta: buildEducationMeta(config.dataset, records.length),
      filters: { region },
      filtered: records.filter((row) => normalize(row.region).includes(normalize(region))),
    });
  }
  const city = universities.at(-1)!.city;
  fixtures.set("/api/v1/education/universites-publiques", {
    records: universities,
    meta: buildEducationMeta("universites-publiques", universities.length),
    filters: { city },
    filtered: universities.filter((row) => normalize(row.city).includes(normalize(city))),
  });
  for (const [dataset, records] of [
    ["hospitals", hospitals],
    ["primary-care-facilities", primaryCare],
    ["private-infrastructure", infrastructure],
  ] as const) {
    const regionCode = records.at(-1)!.region_code!;
    fixtures.set(`/api/v1/health/${dataset}`, {
      records,
      meta: buildDatasetMeta(dataset, records.length),
      filters: { region_code: regionCode },
      filtered: records.filter((row) => row.region_code === regionCode),
    });
  }
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app?.close();
});

describe("Education and health collection pagination", () => {
  for (const path of paths) {
    it(`${path} defaults to a bounded first page and retains every record across pages`, async () => {
      const fixture = fixtures.get(path)!;
      const firstPage = await app.inject(path);
      assert.equal(firstPage.statusCode, 200);
      const firstCount = Math.min(100, fixture.records.length);
      assert.deepEqual(firstPage.json(), {
        data: fixture.records.slice(0, 100),
        meta: {
          ...fixture.meta as object,
          pagination: {
            limit: 100, offset: 0, count: firstCount,
            has_more: fixture.records.length > 100,
            next_offset: fixture.records.length > 100 ? 100 : null,
          },
        },
      });
      const allPages = await collectAllPages(app, path);
      assert.deepEqual(allPages.data, fixture.records);
      const { pagination: firstPagination, ...allSourceMeta } = allPages.meta;
      assert.deepEqual(allSourceMeta, fixture.meta);

      const offset = 2;
      const response = await app.inject(`${path}?offset=${offset}`);
      assert.equal(response.statusCode, 200);
      const page = response.json<Collection>();
      const expected = fixture.records.slice(offset, offset + 100);
      assert.deepEqual(page.data, expected);
      assert.deepEqual(page.meta.pagination, {
        limit: 100, offset, count: expected.length,
        has_more: offset + expected.length < fixture.records.length,
        next_offset: offset + expected.length < fixture.records.length ? offset + expected.length : null,
      });
      const { pagination, ...meta } = page.meta;
      assert.deepEqual(meta, fixture.meta);

      const beyond = await app.inject(`${path}?limit=2&offset=2147483647`);
      assert.equal(beyond.statusCode, 200);
      assert.deepEqual(beyond.json<Collection>().data, []);
      assert.equal(beyond.json<Collection>().meta.total, fixture.records.length);
      assert.deepEqual(beyond.json<Collection>().meta.pagination, {
        limit: 2, offset: 2147483647, count: 0, has_more: false, next_offset: null,
      });
    });

    it(`${path} filters before pagination and reconstructs the ordered filtered list`, async () => {
      const fixture = fixtures.get(path)!;
      assert.ok(fixture.filtered.length > 0);
      assert.ok(fixture.filtered.length < fixture.records.length, "The filter must exclude records before paging");
      const query = new URLSearchParams(fixture.filters);
      const defaultPage = await app.inject(`${path}?${query}`);
      assert.equal(defaultPage.statusCode, 200);
      const filtered = defaultPage.json<Collection>();
      assert.deepEqual(filtered.data, fixture.filtered.slice(0, 100));
      assert.equal(filtered.meta.total, fixture.filtered.length);
      assert.deepEqual(filtered.meta.pagination, {
        limit: 100, offset: 0, count: Math.min(100, fixture.filtered.length),
        has_more: fixture.filtered.length > 100,
        next_offset: fixture.filtered.length > 100 ? 100 : null,
      });
      const { pagination: defaultPagination, ...filteredSourceMeta } = filtered.meta;

      const limit = Math.min(500, Math.max(1, Math.ceil(fixture.filtered.length / 3)));
      const collected: unknown[] = [];
      let offset = 0;
      do {
        const pageQuery = new URLSearchParams(fixture.filters);
        pageQuery.set("limit", String(limit));
        pageQuery.set("offset", String(offset));
        const response = await app.inject(`${path}?${pageQuery}`);
        assert.equal(response.statusCode, 200);
        const page = response.json<Collection>();
        const expected = fixture.filtered.slice(offset, offset + limit);
        assert.deepEqual(page.data, expected);
        assert.equal(page.meta.total, fixture.filtered.length);
        assert.deepEqual(page.meta.pagination, {
          limit, offset, count: expected.length,
          has_more: offset + expected.length < fixture.filtered.length,
          next_offset: offset + expected.length < fixture.filtered.length ? offset + expected.length : null,
        });
        const { pagination, ...meta } = page.meta;
        assert.deepEqual(meta, filteredSourceMeta);
        collected.push(...page.data);
        if (pagination.next_offset === null) break;
        assert.ok(pagination.next_offset > offset, "Each page must advance");
        offset = pagination.next_offset;
      } while (offset < fixture.filtered.length);
      assert.deepEqual(collected, fixture.filtered);
    });

    it(`${path} rejects invalid pagination`, async () => {
      for (const query of ["limit=0", "limit=501", "offset=-1"]) {
        const response = await app.inject(`${path}?${query}`);
        assert.equal(response.statusCode, 400, query);
        assert.equal(response.json().error.code, "VALIDATION_ERROR", query);
      }
    });
  }

  it("documents default pagination and required page metadata on all eleven education and health collections", async () => {
    const response = await app.inject("/openapi.json");
    assert.equal(response.statusCode, 200);
    const spec = response.json();
    for (const path of paths) {
      const operation = spec.paths[path].get;
      for (const name of ["limit", "offset"]) {
        const parameter = operation.parameters.find((item: { name: string }) => item.name === name);
        assert.ok(parameter, `${path}: ${name} must be documented`);
        assert.equal(parameter.required, false);
        assert.equal(parameter.schema.default, name === "limit" ? 100 : 0);
      }
      const meta = operation.responses["200"].content["application/json"].schema.properties.meta;
      assert.ok(meta.properties.pagination, path);
      assert.ok(meta.required.includes("pagination"), "Every collection response must include pagination metadata");
    }
  });
});
