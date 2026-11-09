import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paginate, paginateWindow } from "../../src/common/pagination.js";

describe("paginateWindow", () => {
  const records = Array.from({ length: 23 }, (_, index) => ({ index }));
  const meta = { dataset: "test", total: records.length };

  it("returns exactly what paginate returns for the full list", () => {
    for (const limit of [undefined, 1, 5, 22, 23, 24, 500]) {
      for (const offset of [undefined, 0, 1, 4, 5, 22, 23, 24, 1_000]) {
        const query = { limit, offset };
        const expected = paginate(records, meta, query);
        const actual = paginateWindow(records.length, (start, count) => records.slice(start, start + count), meta, query);
        assert.deepEqual(actual, expected, JSON.stringify(query));
      }
    }
  });

  it("asks only for the requested page, and nothing past the end", () => {
    const calls: [number, number][] = [];
    const readPage = (offset: number, count: number) => {
      calls.push([offset, count]);
      return records.slice(offset, offset + count);
    };
    paginateWindow(records.length, readPage, meta, { limit: 5, offset: 10 });
    paginateWindow(records.length, readPage, meta, { limit: 5, offset: 20 });
    paginateWindow(records.length, readPage, meta, { limit: 5, offset: 23 });
    paginateWindow(0, readPage, { ...meta, total: 0 }, {});
    assert.deepEqual(calls, [[10, 5], [20, 3]]);
  });

  it("rejects a page reader that returns the wrong number of records", () => {
    assert.throws(() => paginateWindow(10, () => [], meta, { limit: 3 }), /Expected 3 records from offset 0, got 0/);
  });
});
