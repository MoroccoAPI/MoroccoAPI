import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

function numberUrl(endpoint: string, number: string): string {
  return `/api/v1/telecom/phone-numbers/${endpoint}?${new URLSearchParams({ number })}`;
}

describe("telecom/phone-numbers", () => {
  it("normalizes national, significant, international and Unicode forms consistently", async () => {
    const inputs = ["0612 123 456", "612123456", "+212 612-123-456", "00212 (612) 123456", "٠٦١٢١٢٣٤٥٦", "۰۶۱۲۱۲۳۴۵۶", "０６１２１２３４５６"];
    for (const input of inputs) {
      const response = await app.inject({ method: "GET", url: numberUrl("validate", input) });
      assert.equal(response.statusCode, 200, input);
      const body = response.json();
      assert.equal(body.data.e164, "+212612123456", input);
      assert.equal(body.data.national_number, "0612123456");
      assert.equal(body.data.is_valid_format, true);
      assert.equal(body.data.number_type, "mobile");
      assert.equal(body.data.is_allocated_range, null);
      assert.deepEqual(Object.keys(body.meta).sort(), ["dataset", "license", "retrieved_at", "sources", "total", "transformation_version"]);
    }
  });

  it("uses specific carrier overrides and supports the new Orange destinations", async () => {
    for (const [number, operator, prefix] of [
      ["0610123456", "maroc-telecom", "061"],
      ["0612123456", "orange", "0612"],
      ["0730123456", "orange", "073"],
      ["0731123456", "orange", "073"],
      ["0600123456", "inwi", "060"],
    ]) {
      const response = await app.inject({ method: "GET", url: numberUrl("lookup", number!) });
      assert.equal(response.statusCode, 200);
      const data = response.json().data;
      assert.equal(data.original_operator.code, operator);
      assert.equal(data.matched_prefix, prefix);
      assert.equal(data.current_operator, null);
      assert.equal(data.geographic_area, null);
      assert.equal(data.is_allocated_range, null);
    }
  });

  it("resolves specific geographic descriptions without inventing a fixed operator or city", async () => {
    const response = await app.inject({ method: "GET", url: numberUrl("lookup", "0529612345") });
    assert.equal(response.statusCode, 200);
    const data = response.json().data;
    assert.equal(data.matched_prefix, "05296");
    assert.equal(data.geographic_area.description.fr, "Marrakech");
    assert.equal(data.original_operator, null);
    assert.equal(data.geographic_area.hcp_code, null);
    const multi = await app.inject({ method: "GET", url: numberUrl("lookup", "0549123456") });
    assert.deepEqual(multi.json().data.geographic_area.areas.fr, ["Casablanca", "Marrakech", "Agadir"]);
  });

  it("supports valid non-geographic numbers when no prefix mapping exists", async () => {
    const response = await app.inject({ method: "GET", url: numberUrl("lookup", "0808212345") });
    assert.equal(response.statusCode, 200);
    const data = response.json().data;
    assert.equal(data.number_type, "voip");
    assert.equal(data.has_known_prefix, false);
    assert.equal(data.matched_prefix, null);
    assert.equal(data.original_operator, null);
    assert.equal(data.geographic_area, null);
  });

  it("distinguishes a known broad prefix from a valid number pattern", async () => {
    const response = await app.inject({ method: "GET", url: numberUrl("validate", "0732123456") });
    const data = response.json().data;
    assert.equal(data.is_possible, true);
    assert.equal(data.has_known_prefix, true);
    assert.equal(data.is_valid_format, false);
    assert.equal(data.reason, "INVALID_NUMBER_PATTERN");
    for (const input of ["0732123456", "0538212345", "0538312345"]) {
      const lookup = await app.inject({ method: "GET", url: numberUrl("lookup", input) });
      assert.equal(lookup.statusCode, 400);
      assert.equal(lookup.json().error.code, "INVALID_PHONE_NUMBER");
      assert.ok(!lookup.body.includes(input));
    }
  });

  it("rejects foreign numbers, malformed strings, short codes and international trunk zeros", async () => {
    for (const [input, reason] of [
      ["+33612123456", "NOT_MOROCCAN"],
      ["0033612123456", "NOT_MOROCCAN"],
      ["Call 0612123456", "INVALID_CHARACTERS"],
      ["0612123456 ext 2", "INVALID_CHARACTERS"],
      ["0612123456\n0612123456", "INVALID_CHARACTERS"],
      ["177", "INVALID_LENGTH"],
      ["+2120612123456", "INVALID_LENGTH"],
      ["06121234567", "INVALID_LENGTH"],
    ]) {
      const response = await app.inject({ method: "GET", url: numberUrl("validate", input!) });
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.reason, reason, input);
      assert.equal(response.json().data.e164, null);
    }
  });

  it("recognizes known prefixes even when the number is too short or too long", async () => {
    for (const input of ["061212345", "06121234567", "61212345", "6121234567", "+21261212345", "002126121234567", "٠٦١٢١٢٣٤٥"]) {
      const response = await app.inject({ method: "GET", url: numberUrl("validate", input) });
      assert.equal(response.statusCode, 200, input);
      const data = response.json().data;
      assert.equal(data.reason, "INVALID_LENGTH", input);
      assert.equal(data.has_known_prefix, true, input);
      assert.equal(data.is_possible, false);
      assert.equal(data.is_valid_format, false);
      assert.equal(data.e164, null);
      assert.equal(data.national_number, null);
      assert.equal(data.number_type, null);

      const lookup = await app.inject({ method: "GET", url: numberUrl("lookup", input) });
      assert.equal(lookup.statusCode, 400, input);
      assert.equal(lookup.json().error.code, "INVALID_PHONE_NUMBER");
    }
    for (const input of ["080821234", "+33612123456", "061212345 ext 2", "+2120612123456", "177"]) {
      const response = await app.inject({ method: "GET", url: numberUrl("validate", input) });
      assert.equal(response.json().data.has_known_prefix, false, input);
    }
  });

  it("requires one bounded number query", async () => {
    for (const query of ["", "?number=", "?number=0612123456&number=0613123456", `?number=${"6".repeat(65)}`]) {
      const response = await app.inject({ method: "GET", url: `/api/v1/telecom/phone-numbers/validate${query}` });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });
});

describe("telecom/ranges and areas", () => {
  it("lists the licensed dataset with provenance and filters", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/telecom/numbering-ranges" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 156);
    assert.equal(response.json().data.length, 156);
    assert.equal(response.json().meta.license, "Apache-2.0");
    for (const source of response.json().meta.sources) {
      assert.equal(source.source_updated_at, null);
      assert.match(source.resource_url, /\/google\/libphonenumber\/[0-9a-f]{40}\/resources\//);
    }
    const filtered = await app.inject({ method: "GET", url: "/api/v1/telecom/numbering-ranges?operator=orange&prefix=061&category=carrier" });
    assert.deepEqual(filtered.json().data.map((row: { prefix: string }) => row.prefix), ["0612", "0614", "0617", "0619"]);
    assert.equal(filtered.json().meta.total, 4);
    const empty = await app.inject({ method: "GET", url: "/api/v1/telecom/numbering-ranges?operator=unknown-operator" });
    assert.deepEqual(empty.json().data, []);
    assert.equal(empty.json().meta.total, 0);
  });

  it("gets exact prefixes and documents more specific overrides", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/telecom/numbering-ranges/061" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data.more_specific_prefixes, ["0612", "0614", "0617", "0619"]);
    assert.equal(response.json().data.mask, "061XXXXXXX");
    for (const url of ["/api/v1/telecom/numbering-ranges/0610", "/api/v1/telecom/area-codes/05382"]) {
      const missing = await app.inject({ method: "GET", url });
      assert.equal(missing.statusCode, 404);
      assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
    }
  });

  it("lists and retrieves multilingual area descriptions with source labels preserved", async () => {
    const list = await app.inject({ method: "GET", url: "/api/v1/telecom/area-codes" });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().meta.total, 77);
    const filtered = await app.inject({ method: "GET", url: "/api/v1/telecom/area-codes?prefix=0537" });
    assert.equal(filtered.json().meta.total, 8);
    const detail = await app.inject({ method: "GET", url: "/api/v1/telecom/area-codes/05376" });
    assert.equal(detail.statusCode, 200);
    assert.deepEqual(detail.json().data.areas.fr, ["Rabat", "Témara"]);
    assert.equal(detail.json().data.description.ar, null);
    assert.equal(detail.json().data.hcp_code, null);
    assert.equal(detail.json().data.description.en, "Rabat/Témara");
  });

  it("validates prefix and category parameters", async () => {
    for (const url of ["/api/v1/telecom/numbering-ranges?category=invalid", "/api/v1/telecom/numbering-ranges/abc", "/api/v1/telecom/area-codes?prefix=212", "/api/v1/telecom/area-codes/0537123456"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });
});

it("publishes all six telecom paths in OpenAPI", async () => {
  const response = await app.inject({ method: "GET", url: "/openapi.json" });
  for (const path of ["phone-numbers/validate", "phone-numbers/lookup", "numbering-ranges", "numbering-ranges/{prefix}", "area-codes", "area-codes/{code}"]) {
    assert.ok(response.json().paths[`/api/v1/telecom/${path}`]);
  }
});

it("does not put telephone input in Fastify request or validation logs", async () => {
  const chunks: string[] = [];
  const loggingApp = await buildApp({ logger: { level: "info", stream: { write: (chunk: string) => { chunks.push(chunk); } } } });
  try {
    for (const endpoint of ["validate", "lookup"]) {
      await loggingApp.inject({ method: "GET", url: numberUrl(endpoint, "0612123456") });
      await loggingApp.inject({ method: "GET", url: numberUrl(endpoint, "0612123456 ext 2") });
      await loggingApp.inject({ method: "GET", url: numberUrl(endpoint, "6".repeat(65)) });
    }
    await loggingApp.inject({ method: "GET", url: "/api/v1/status" });
  } finally {
    await loggingApp.close();
  }
  assert.ok(chunks.join("").includes("/api/v1/status"), "unrelated request logging is retained");
  assert.ok(!chunks.join("").includes("0612123456"));
  assert.ok(!chunks.join("").includes("6".repeat(65)));
  assert.ok(chunks.join("").includes("phone-numbers"), "request paths remain logged without query values");
});
