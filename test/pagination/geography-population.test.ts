import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";

interface CollectionBody {
  data: Record<string, unknown>[];
  meta: {
    total: number;
    pagination: {
      limit: number;
      offset: number;
      count: number;
      has_more: boolean;
      next_offset: number | null;
    };
    [key: string]: unknown;
  };
}

const collections = [
  { path: "/api/v1/regions", count: 12, pageSize: 5 },
  { path: "/api/v1/provinces", count: 75, pageSize: 17 },
  { path: "/api/v1/prefectures-of-arrondissements", count: 8, pageSize: 3 },
  { path: "/api/v1/communes", count: 1503, pageSize: 400 },
  { path: "/api/v1/arrondissements", count: 41, pageSize: 17 },
  { path: "/api/v1/population/regions", count: 12, pageSize: 5 },
  { path: "/api/v1/population/historical", count: 7, pageSize: 3 },
  { path: "/api/v1/population/subdivisions", count: 75, pageSize: 17 },
  { path: "/api/v1/population/communes", count: 1503, pageSize: 400 },
] as const;

const filteredCollections = [
  "/api/v1/regions/rabat-sale-kenitra/subdivisions",
  "/api/v1/locations/search?q=ma",
];

let app: FastifyInstance;
const snapshots = new Map<string, CollectionBody>();

async function getCollection(url: string): Promise<CollectionBody> {
  const response = await app.inject(url);
  assert.equal(response.statusCode, 200, url);
  return response.json<CollectionBody>();
}

before(async () => {
  app = await buildApp();
  await app.ready();
  for (const { path } of collections) snapshots.set(path, await collectAllPages(app, path));
});

after(async () => {
  await app.close();
});

describe("geography and population pagination", () => {
  for (const { path, count, pageSize } of collections) {
    it(`bounds ${path} by default and reconstructs its complete dataset`, async () => {
      const complete = snapshots.get(path)!;
      assert.equal(complete.data.length, count);
      assert.equal(complete.meta.total, count);
      const { pagination: _firstPagination, ...completeSourceMeta } = complete.meta;
      const defaultPage = await getCollection(path);
      assert.deepEqual(defaultPage.data, complete.data.slice(0, 100));
      assert.deepEqual(defaultPage.meta.pagination, {
        limit: 100,
        offset: 0,
        count: Math.min(100, count),
        has_more: count > 100,
        next_offset: count > 100 ? 100 : null,
      });

      const reconstructed: Record<string, unknown>[] = [];
      let offset = 0;
      while (true) {
        const page = await getCollection(`${path}?limit=${pageSize}&offset=${offset}`);
        const { pagination, ...sourceMeta } = page.meta;
        assert.ok(pagination);
        assert.deepEqual(sourceMeta, completeSourceMeta);
        assert.equal(pagination.limit, pageSize);
        assert.equal(pagination.offset, offset);
        assert.equal(pagination.count, page.data.length);
        assert.deepEqual(page.data, complete.data.slice(offset, offset + pageSize));
        reconstructed.push(...page.data);

        if (!pagination.has_more) {
          assert.equal(pagination.next_offset, null);
          break;
        }
        assert.equal(pagination.next_offset, offset + pageSize);
        assert.ok(pagination.next_offset > offset);
        offset = pagination.next_offset;
      }

      assert.deepEqual(reconstructed, complete.data);
      assert.deepEqual(await getCollection(path), defaultPage);

      const empty = await getCollection(`${path}?limit=${pageSize}&offset=2147483647`);
      assert.deepEqual(empty.data, []);
      assert.equal(empty.meta.total, count);
      assert.deepEqual(empty.meta.pagination, {
        limit: pageSize,
        offset: 2147483647,
        count: 0,
        has_more: false,
        next_offset: null,
      });
    });
  }

  it("applies the other parameter's default when only one is supplied", async () => {
    const complete = snapshots.get("/api/v1/communes")!;
    const limitOnly = await getCollection("/api/v1/communes?limit=2");
    assert.deepEqual(limitOnly.data, complete.data.slice(0, 2));
    assert.deepEqual(limitOnly.meta.pagination, {
      limit: 2, offset: 0, count: 2, has_more: true, next_offset: 2,
    });

    const offsetOnly = await getCollection("/api/v1/communes?offset=2");
    assert.deepEqual(offsetOnly.data, complete.data.slice(2, 102));
    assert.deepEqual(offsetOnly.meta.pagination, {
      limit: 100, offset: 2, count: 100, has_more: true, next_offset: 102,
    });
    assert.equal(offsetOnly.meta.total, complete.meta.total);
  });

  it("pages subdivisions after selecting the requested region", async () => {
    const regionCode = "rabat-sale-kenitra";
    const expected = snapshots.get("/api/v1/provinces")!.data.filter((record) => record.region_code === regionCode);
    const path = `/api/v1/regions/${regionCode}/subdivisions`;
    const defaultPage = await getCollection(path);
    assert.deepEqual(defaultPage.data, expected);
    assert.deepEqual(defaultPage.meta.pagination, {
      limit: 100, offset: 0, count: expected.length, has_more: false, next_offset: null,
    });

    const page = await getCollection(`${path}?limit=2&offset=1`);
    assert.deepEqual(page.data, expected.slice(1, 3));
    assert.equal(page.meta.total, expected.length);
    assert.deepEqual(page.meta.pagination, {
      limit: 2, offset: 1, count: 2, has_more: true, next_offset: 3,
    });

    const empty = await getCollection(`${path}?limit=2&offset=2147483647`);
    assert.deepEqual(empty.data, []);
    assert.equal(empty.meta.total, expected.length);
    assert.equal(empty.meta.pagination.has_more, false);

    const missing = await app.inject("/api/v1/regions/unknown-region/subdivisions?limit=2&offset=2147483647");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("pages search matches while preserving search validation and filtered totals", async () => {
    const path = "/api/v1/locations/search?q=ma";
    const defaultPage = await getCollection(path);
    assert.ok(defaultPage.data.length > 2);
    assert.deepEqual(defaultPage.meta.pagination, {
      limit: 100, offset: 0, count: defaultPage.data.length, has_more: false, next_offset: null,
    });

    const page = await getCollection(`${path}&limit=1&offset=1`);
    assert.deepEqual(page.data, defaultPage.data.slice(1, 2));
    assert.equal(page.meta.total, defaultPage.data.length);
    assert.deepEqual(page.meta.pagination, {
      limit: 1, offset: 1, count: 1, has_more: true, next_offset: 2,
    });

    const noMatches = await getCollection("/api/v1/locations/search?q=no-matching-region-999&limit=2");
    assert.deepEqual(noMatches.data, []);
    assert.equal(noMatches.meta.total, 0);
    assert.deepEqual(noMatches.meta.pagination, {
      limit: 2, offset: 0, count: 0, has_more: false, next_offset: null,
    });

    for (const url of ["/api/v1/locations/search?limit=2", "/api/v1/locations/search?q=%20%20&limit=2"]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });

  it("preserves historical record identity and leaves object endpoints unchanged", async () => {
    const page = await getCollection("/api/v1/population/historical?limit=2&offset=1");
    const history = snapshots.get("/api/v1/population/historical")!.data;
    assert.deepEqual(page.data, history.slice(1, 3));
    for (const record of page.data) {
      const detail = await app.inject(`/api/v1/population/historical/${record.year}`);
      assert.equal(detail.statusCode, 200);
      assert.deepEqual(detail.json().data, record);
      assert.ok(!("pagination" in detail.json().meta));
    }

    for (const path of [
      "/api/v1/population/national",
      "/api/v1/population/regions/fes-meknes",
      "/api/v1/communes/azilal--afourar",
    ]) {
      const baseline = await app.inject(path);
      const withQuery = await app.inject(`${path}?limit=1&offset=1`);
      assert.equal(baseline.statusCode, 200, path);
      assert.equal(withQuery.statusCode, 200, path);
      assert.deepEqual(withQuery.json(), baseline.json(), path);
      assert.ok(!("pagination" in withQuery.json().meta));
    }
  });

  it("validates pagination on every collection route", async () => {
    for (const path of [...collections.map(({ path }) => path), ...filteredCollections]) {
      const separator = path.includes("?") ? "&" : "?";
      for (const query of ["limit=501", "offset=-1"]) {
        const url = `${path}${separator}${query}`;
        const response = await app.inject(url);
        assert.equal(response.statusCode, 400, url);
        assert.equal(response.json().error.code, "VALIDATION_ERROR");
      }
    }
  });

});
