import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";

interface CollectionResponse {
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
    [key: string]: unknown;
  };
}

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

async function collection(url: string): Promise<CollectionResponse> {
  const response = await app.inject(url);
  assert.equal(response.statusCode, 200, url);
  return response.json<CollectionResponse>();
}

function pageUrl(url: string, pagination: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}${pagination}`;
}

const directories = [
  "/api/v1/telecom/numbering-ranges",
  "/api/v1/telecom/area-codes",
  "/api/v1/postal-codes?city=rabat",
  "/api/v1/postal-codes/cities",
  "/api/v1/postal-codes/10000",
  "/api/v1/airports",
  "/api/v1/museums",
  "/api/v1/ports",
  "/api/v1/lighthouses",
  "/api/v1/world-bank/indicators",
  "/api/v1/world-bank/indicators/topics",
];

describe("Directory pagination", () => {
  it("paginates every ordinary request and reconstructs stable complete results through pages", async () => {
    for (const url of directories) {
      const complete = await collectAllPages(app, url);
      assert.ok(complete.data.length > 3, url);
      assert.equal(complete.meta.total, complete.data.length, url);
      const ordinary = await collection(url);
      const count = Math.min(100, complete.data.length);
      assert.deepEqual(ordinary.data, complete.data.slice(0, 100), url);
      assert.deepEqual(ordinary.meta, {
        ...complete.meta,
        pagination: {
          limit: 100, offset: 0, count,
          has_more: complete.data.length > count,
          next_offset: complete.data.length > count ? count : null,
        },
      }, url);

      const page = await collection(pageUrl(url, "limit=2&offset=1"));
      assert.deepEqual(page.data, complete.data.slice(1, 3), url);
      assert.deepEqual(page.meta, {
        ...complete.meta,
        pagination: { limit: 2, offset: 1, count: 2, has_more: true, next_offset: 3 },
      }, url);
      assert.deepEqual(await collection(url), ordinary, `${url}: page requests must not alter the default page`);
    }
  });

  it("applies every directory's existing filters before slicing and keeps the filtered total", async () => {
    const filteredDirectories = [
      "/api/v1/telecom/numbering-ranges?prefix=061&operator=orange&category=carrier",
      "/api/v1/telecom/area-codes?prefix=0537",
      "/api/v1/postal-codes?city=rabat&q=quartier%20al%20boustane&type=neighborhood",
      "/api/v1/airports?type=closed&scheduled_service=false",
      "/api/v1/museums?city_code=tanger-assilah--tanger&region_code=tanger-tetouan-al-hoceima&q=kasbah",
    ];
    for (const url of filteredDirectories) {
      const filtered = await collectAllPages(app, url);
      assert.ok(filtered.data.length >= 2, url);
      const page = await collection(pageUrl(url, "limit=1&offset=1"));
      assert.deepEqual(page.data, filtered.data.slice(1, 2), url);
      assert.equal(page.meta.total, filtered.data.length, url);
      assert.deepEqual(page.meta.pagination, {
        limit: 1,
        offset: 1,
        count: 1,
        has_more: filtered.data.length > 2,
        next_offset: filtered.data.length > 2 ? 2 : null,
      }, url);
    }
  });

  it("pages all places sharing a postal code in their stable published order", async () => {
    const url = "/api/v1/postal-codes/10000";
    const complete = await collectAllPages(app, url);
    assert.ok(complete.data.length > 2);
    const combined = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await collection(pageUrl(url, `limit=2&offset=${offset}`));
      assert.equal(page.meta.total, complete.data.length);
      assert.equal(page.meta.pagination.count, page.data.length);
      combined.push(...page.data);
      const nextOffset = page.meta.pagination.next_offset;
      if (nextOffset !== null) assert.ok(nextOffset > offset);
      offset = nextOffset;
    }
    assert.deepEqual(combined, complete.data);
  });

  it("uses defaults independently for offset-only and limit-only requests", async () => {
    const url = "/api/v1/telecom/numbering-ranges";
    const complete = await collectAllPages(app, url);
    assert.ok(complete.data.length > 100);
    const offsetOnly = await collection(`${url}?offset=2`);
    assert.deepEqual(offsetOnly.data, complete.data.slice(2, 102));
    assert.deepEqual(offsetOnly.meta.pagination, {
      limit: 100, offset: 2, count: 100, has_more: true, next_offset: 102,
    });
    const limitOnly = await collection(`${url}?limit=1`);
    assert.deepEqual(limitOnly.data, complete.data.slice(0, 1));
    assert.deepEqual(limitOnly.meta.pagination, {
      limit: 1, offset: 0, count: 1, has_more: true, next_offset: 1,
    });
  });

  it("returns an empty page at and beyond the end without losing the matching total", async () => {
    const url = "/api/v1/postal-codes/cities";
    const complete = await collectAllPages(app, url);
    for (const offset of [complete.data.length, 2_147_483_647]) {
      const page = await collection(`${url}?limit=2&offset=${offset}`);
      assert.deepEqual(page.data, []);
      assert.equal(page.meta.total, complete.meta.total);
      assert.deepEqual(page.meta.pagination, {
        limit: 2, offset, count: 0, has_more: false, next_offset: null,
      });
    }
  });

  it("keeps postal search requirements and missing-code errors ahead of pagination", async () => {
    for (const url of ["/api/v1/postal-codes?limit=1", "/api/v1/postal-codes?offset=1&type=neighborhood"]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
    const missing = await app.inject("/api/v1/postal-codes/99999?limit=1&offset=2147483647");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
    const noMatches = await collection("/api/v1/postal-codes?city=rabat&q=doesnotexist&limit=1");
    assert.deepEqual(noMatches.data, []);
    assert.equal(noMatches.meta.total, 0);
    assert.deepEqual(noMatches.meta.pagination, {
      limit: 1, offset: 0, count: 0, has_more: false, next_offset: null,
    });
  });

  it("validates pagination on every directory route", async () => {
    for (const url of directories) {
      for (const invalid of ["limit=0", "offset=-1"]) {
        const response = await app.inject(pageUrl(url, invalid));
        assert.equal(response.statusCode, 400, `${url}: ${invalid}`);
        assert.equal(response.json().error.code, "VALIDATION_ERROR");
      }
    }
  });

  it("keeps object details and phone lookup outside collection pagination", async () => {
    const museums = (await collection("/api/v1/museums")).data as { id: string }[];
    const details = [
      "/api/v1/telecom/numbering-ranges/061",
      "/api/v1/telecom/area-codes/05376",
      "/api/v1/telecom/phone-numbers/lookup?number=0612345678",
      "/api/v1/airports/GMMN",
      `/api/v1/museums/${museums[0]!.id}`,
      "/api/v1/ports/Casablanca",
      "/api/v1/world-bank/indicators/IT.NET.USER.ZS",
    ];
    for (const url of details) {
      const ordinary = await app.inject(url);
      const supplied = await app.inject(pageUrl(url, "limit=1&offset=1"));
      assert.equal(ordinary.statusCode, 200, url);
      assert.equal(supplied.statusCode, 200, url);
      assert.equal(Array.isArray(supplied.json().data), false, url);
      assert.deepEqual(supplied.json(), ordinary.json(), url);
    }
  });
});
