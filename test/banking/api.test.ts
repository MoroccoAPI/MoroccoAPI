import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadBankingData } from "../../src/banking/data.js";
import { collectAllPages } from "../helpers/pagination.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Banking endpoints", () => {
  it("paginates both full lists in source order without loss or duplication", async () => {
    const { data } = await loadBankingData();
    for (const [path, records] of [["institutions", data.institutions], ["bank-codes", data.bank_codes]] as const) {
      const result = await collectAllPages(app, `/api/v2/banking/${path}`);
      assert.deepEqual(result.data, records);
      assert.equal(result.meta.total, records.length);
      const empty = await app.inject(`/api/v2/banking/${path}?offset=2147483647&limit=1`);
      assert.deepEqual(empty.json().data, []);
      assert.equal(empty.json().meta.total, records.length);
      assert.equal(empty.json().meta.pagination.has_more, false);
    }
    const first = (await app.inject("/api/v2/banking/institutions")).json();
    assert.equal(first.data.length, 100);
    assert.equal(first.meta.pagination.next_offset, 100);
  });
  it("looks up every identifier and keeps codes with leading zeros", async () => {
    const { data } = await loadBankingData();
    for (const item of data.institutions) {
      const result = await app.inject(`/api/v2/banking/institutions/${item.id}`);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.json().data, item);
    }
    for (const item of data.bank_codes) {
      const result = await app.inject(`/api/v2/banking/bank-codes/${item.code}`);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.json().data, item);
    }
    assert.equal((await app.inject("/api/v2/banking/bank-codes/002")).json().data.name, "ARAB BANK PLC");
    assert.equal((await app.inject("/api/v2/banking/bank-codes/2")).statusCode, 400);
    assert.equal((await app.inject("/api/v2/banking/bank-codes/999")).statusCode, 404);
    assert.equal((await app.inject("/api/v2/banking/institutions/unknown")).statusCode, 404);
  });
  it("combines normalized search and dataset-specific category filters", async () => {
    const plain = await app.inject("/api/v2/banking/institutions?q=credit&category=banks&limit=500");
    const accented = await app.inject("/api/v2/banking/institutions?q=CR%C3%89DIT&category=banks&limit=500");
    assert.deepEqual(plain.json(), accented.json());
    assert.ok(plain.json().data.length > 0);
    assert.ok(plain.json().data.every((item: { category_code: string }) => item.category_code === "banks"));
    const bankCodes = (await app.inject("/api/v2/banking/bank-codes?category=participative-bank")).json();
    assert.equal(bankCodes.meta.total, 5);
    assert.deepEqual(bankCodes.data.map((item: { code: string }) => item.code), ["360", "362", "365", "366", "367"]);
    assert.equal((await app.inject("/api/v2/banking/institutions?q=does-not-exist")).json().meta.total, 0);
  });
  it("lists separate category vocabularies with their counts", async () => {
    const all = (await app.inject("/api/v2/banking/categories")).json();
    assert.equal(all.meta.total, 18);
    for (const [dataset, count, total] of [["institutions", 15, 107], ["bank-codes", 3, 39]] as const) {
      const response = (await app.inject(`/api/v2/banking/categories?dataset=${dataset}`)).json();
      assert.equal(response.data.length, count);
      assert.equal(response.data.reduce((sum: number, item: { count: number }) => sum + item.count, 0), total);
    }
  });
  it("rejects invalid filters, unknown parameters and repeated query values", async () => {
    for (const path of [
      "institutions?q=%20%20", "institutions?q=x", "institutions?q=a&q=b", "institutions?category=bank",
      "bank-codes?category=banks", "bank-codes?limit=501", "institutions?offset=-1", "institutions?swift=ABC",
      "bank-codes/007?foo=bar", "institutions/attijariwafa-bank?foo=bar", "categories?dataset=unknown",
    ]) {
      const result = await app.inject(`/api/v2/banking/${path}`);
      assert.equal(result.statusCode, 400, path);
      assert.equal(result.json().error.code, "VALIDATION_ERROR", path);
    }
  });
  it("carries attribution, copy date and non-commercial conditions on every response", async () => {
    for (const path of ["institutions", "institutions/attijariwafa-bank", "bank-codes", "bank-codes/007", "categories"]) {
      const result = await app.inject(`/api/v2/banking/${path}`);
      const meta = result.json().meta;
      assert.equal(meta.producer, "Bank Al-Maghrib");
      assert.equal(meta.license, "LicenseRef-BAM-Charte-Diffusion");
      assert.equal(meta.reuse.commercial_use, "written-permission-required");
      assert.match(meta.attribution, /2026-11-07/);
      assert.equal(meta.sources[0].reference_date, null);
      assert.equal(meta.sources[1].date_basis, "source-filename");
      assert.ok(meta.sources.every((source: object) => !Object.hasOwn(source, "file")));
    }
  });
  it("supports v1 aliases, browser access and the translated documentation", async () => {
    const url = "/api/v2/banking/bank-codes/007";
    const current = await app.inject({ url, headers: { origin: "https://example.com" } });
    assert.equal(current.headers["access-control-allow-origin"], "*");
    const legacy = await app.inject(url.replace("v2", "v1"));
    assert.deepEqual(legacy.json(), current.json());
    assert.equal(legacy.headers.link, `<${url}>; rel="successor-version"`);
    for (const language of ["fr", "en", "ar"]) {
      const page = await app.inject(`/docs/${language}/banking/institutions`);
      assert.equal(page.statusCode, 200);
      assert.match(page.body, /LicenseRef-BAM-Charte-Diffusion/);
    }
  });
});
