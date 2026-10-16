import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { collectAllPages } from "../helpers/pagination.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

const collections = [
  { path: "/api/v1/dams", total: 25 },
  { path: "/api/v1/dams/yacoub-el-mansour/levels", total: 62 },
  { path: "/api/v1/dams/tiddas/levels", total: 1 },
];

describe("dams pagination", () => {
  it("uses bounded defaults and reconstructs both collections in their published order", async () => {
    for (const { path, total } of collections) {
      const complete = await collectAllPages(app, path);
      assert.equal(complete.meta.total, total, path);
      const ordinary = await app.inject(path);
      assert.equal(ordinary.statusCode, 200, path);
      assert.deepEqual(ordinary.json().data, complete.data, path);
      assert.deepEqual(ordinary.json().meta.pagination, {
        limit: 100, offset: 0, count: total, has_more: false, next_offset: null,
      }, path);

      const reconstructed = [];
      let offset: number | null = 0;
      while (offset !== null) {
        const page = await app.inject(`${path}?limit=2&offset=${offset}`);
        assert.equal(page.statusCode, 200, path);
        const body = page.json();
        const hasMore = offset + body.data.length < total;
        assert.deepEqual(body.data, complete.data.slice(offset, offset + 2), path);
        assert.equal(body.meta.total, total, path);
        assert.deepEqual(body.meta.pagination, {
          limit: 2, offset, count: body.data.length, has_more: hasMore,
          next_offset: hasMore ? offset + body.data.length : null,
        }, path);
        reconstructed.push(...body.data);
        offset = body.meta.pagination.next_offset;
      }
      assert.deepEqual(reconstructed, complete.data, path);
      assert.deepEqual((await app.inject(path)).json(), ordinary.json(), path);
    }
  });

  it("applies basin and inclusive date filters before pagination while preserving matching totals", async () => {
    const path = "/api/v1/dams/yacoub-el-mansour/levels";
    const complete = await collectAllPages<{ date: string }>(app, path);
    const expected = complete.data.filter((level) => level.date >= "2026-08-31" && level.date <= "2026-09-02");
    assert.equal(expected.length, 3);
    const page = await app.inject(`${path}?from=2026-08-31&to=2026-09-02&limit=1&offset=1`);
    assert.equal(page.statusCode, 200);
    assert.deepEqual(page.json().data, expected.slice(1, 2));
    assert.equal(page.json().meta.total, 3);
    assert.deepEqual(page.json().meta.pagination, {
      limit: 1, offset: 1, count: 1, has_more: true, next_offset: 2,
    });

    const finalPage = await app.inject(`${path}?from=2026-08-31&to=2026-09-02&limit=2&offset=2`);
    assert.equal(finalPage.statusCode, 200);
    assert.deepEqual(finalPage.json().data, expected.slice(2));
    assert.equal(finalPage.json().meta.total, 3);
    assert.deepEqual(finalPage.json().meta.pagination, {
      limit: 2, offset: 2, count: 1, has_more: false, next_offset: null,
    });

    const dams = await collectAllPages(app, "/api/v1/dams?basin=tensift");
    const damPage = await app.inject("/api/v1/dams?basin=tensift&limit=1&offset=1");
    assert.equal(damPage.statusCode, 200);
    assert.deepEqual(damPage.json().data, dams.data.slice(1, 2));
    assert.equal(damPage.json().meta.total, 5);
    assert.deepEqual(damPage.json().meta.pagination, {
      limit: 1, offset: 1, count: 1, has_more: true, next_offset: 2,
    });

    for (const url of [
      "/api/v1/dams?basin=unknown-basin&limit=1&offset=1",
      `${path}?from=2026-10-13&limit=1&offset=1`,
    ]) {
      const empty = await app.inject(url);
      assert.equal(empty.statusCode, 200, url);
      assert.deepEqual(empty.json().data, [], url);
      assert.equal(empty.json().meta.total, 0, url);
      assert.deepEqual(empty.json().meta.pagination, {
        limit: 1, offset: 1, count: 0, has_more: false, next_offset: null,
      }, url);
    }
  });

  it("paginates an added basin and the dashboard observation after historical observations", async () => {
    const bouregreg = await collectAllPages(app, "/api/v1/dams?basin=bouregreg");
    assert.equal(bouregreg.meta.total, 2);
    const page = await app.inject("/api/v1/dams?basin=bouregreg&limit=1&offset=1");
    assert.equal(page.statusCode, 200);
    assert.deepEqual(page.json().data, bouregreg.data.slice(1));
    assert.equal(page.json().meta.total, 2);
    assert.deepEqual(page.json().meta.pagination, {
      limit: 1, offset: 1, count: 1, has_more: false, next_offset: null,
    });

    const latest = await app.inject("/api/v1/dams/yacoub-el-mansour/levels?limit=1&offset=61");
    assert.equal(latest.statusCode, 200);
    assert.equal(latest.json().meta.total, 62);
    assert.equal(latest.json().data[0].date, "2026-10-12");
    assert.equal(latest.json().data[0].source_id, "maadialna-2026-10-12");
    assert.deepEqual(latest.json().meta.pagination, {
      limit: 1, offset: 61, count: 1, has_more: false, next_offset: null,
    });
  });

  it("returns empty pages after the last match and retains missing-dam errors", async () => {
    for (const { path, total } of collections) {
      for (const offset of [total, 2_147_483_647]) {
        const response = await app.inject(`${path}?limit=2&offset=${offset}`);
        assert.equal(response.statusCode, 200, path);
        assert.deepEqual(response.json().data, [], path);
        assert.equal(response.json().meta.total, total, path);
        assert.deepEqual(response.json().meta.pagination, {
          limit: 2, offset, count: 0, has_more: false, next_offset: null,
        }, path);
      }
    }
    const missing = await app.inject("/api/v1/dams/unknown-dam/levels?limit=2&offset=2147483647");
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("rejects invalid, repeated and unsafe pagination values on both routes", async () => {
    for (const { path } of collections) {
      for (const query of [
        "limit=0", "limit=-1", "limit=501", "limit=1.5", "limit=abc", "limit=", "limit=1&limit=2",
        "offset=-1", "offset=0.5", "offset=abc", "offset=", "offset=2147483648", "offset=9007199254740992", "offset=1&offset=2",
      ]) {
        const url = `${path}?${query}`;
        const response = await app.inject(url);
        assert.equal(response.statusCode, 400, url);
        const error = response.json().error;
        assert.equal(error.code, "VALIDATION_ERROR", url);
        assert.equal(typeof error.request_id, "string", url);
        assert.ok(error.request_id.length > 0, url);
      }
    }
  });
});
