import assert from "node:assert/strict";

import type { FastifyInstance } from "fastify";

interface PageMetadata {
  total: number;
  pagination: {
    limit: number;
    offset: number;
    count: number;
    has_more: boolean;
    next_offset: number | null;
  };
  [key: string]: unknown;
}

/** Follow the public pagination contract when a test needs the entire collection. */
export async function collectAllPages<T = Record<string, unknown>>(
  app: FastifyInstance,
  url: string,
): Promise<{ data: T[]; meta: PageMetadata }> {
  const query = new URL(url, "http://localhost");
  query.searchParams.set("limit", "500");
  const data: T[] = [];
  let offset = 0;
  let firstMeta: PageMetadata | undefined;

  while (true) {
    query.searchParams.set("offset", String(offset));
    const response = await app.inject(query.pathname + query.search);
    assert.equal(response.statusCode, 200, query.pathname + query.search);
    const page = response.json<{ data: T[]; meta: PageMetadata }>();
    assert.ok(Array.isArray(page.data), url);
    assert.ok(Number.isSafeInteger(page.meta.total) && page.meta.total >= 0, url);
    assert.ok(page.meta.pagination, url);
    const { pagination, ...metadata } = page.meta;
    assert.equal(pagination.limit, 500, url);
    assert.equal(pagination.offset, offset, url);
    assert.equal(pagination.count, page.data.length, url);
    assert.ok(page.data.length <= pagination.limit, url);
    assert.equal(pagination.has_more, offset + page.data.length < page.meta.total, url);
    assert.equal(pagination.next_offset, pagination.has_more ? offset + page.data.length : null, url);

    if (firstMeta === undefined) firstMeta = page.meta;
    else {
      const { pagination: firstPagination, ...firstMetadata } = firstMeta;
      assert.deepEqual(metadata, firstMetadata, url);
    }
    data.push(...page.data);
    if (!pagination.has_more) break;
    assert.ok(pagination.next_offset! > offset, url);
    offset = pagination.next_offset!;
  }

  assert.equal(data.length, firstMeta!.total, url);
  return { data, meta: firstMeta! };
}
