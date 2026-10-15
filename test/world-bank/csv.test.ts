import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCsv } from "../../src/world-bank/data/csv.js";

describe("world-bank/csv", () => {
  it("parses quoted fields with commas, quotes and line breaks", () => {
    assert.deepEqual(parseCsv('"a","b, c","say ""hi""","line\nbreak"\n'), [["a", "b, c", 'say "hi"', "line\nbreak"]]);
  });

  it("accepts LF and CRLF, strips a UTF-8 BOM and keeps empty and trailing fields", () => {
    assert.deepEqual(parseCsv('﻿"x","",\r\n"y","1",\n'), [["x", "", ""], ["y", "1", ""]]);
  });

  it("parses unquoted fields and a last line without a newline", () => {
    assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
  });

  it("rejects unterminated or misplaced quotes", () => {
    assert.throws(() => parseCsv('"open'), /Unterminated quoted field/);
    assert.throws(() => parseCsv('ab"c"'), /Unexpected quote/);
  });
});
