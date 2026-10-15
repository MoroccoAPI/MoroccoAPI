import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import Ajv from "ajv";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadLighthouses, loadPorts } from "../../src/maritime/data.js";
import type { Lighthouse, Port } from "../../src/maritime/types.js";

let app: FastifyInstance;
let portRecords: readonly Port[];
let lighthouseRecords: readonly Lighthouse[];
before(async () => {
  app = await buildApp();
  await app.ready();
  [portRecords, lighthouseRecords] = await Promise.all([loadPorts(), loadLighthouses()]);
});
after(async () => { await app.close(); });

async function assertPages(url: string, expected: readonly unknown[], limit: number) {
  const query = new URL(url, "http://localhost");
  query.searchParams.set("limit", String(limit));
  const records: unknown[] = [];
  let offset = 0;
  while (true) {
    query.searchParams.set("offset", String(offset));
    const response = await app.inject(query.pathname + query.search);
    assert.equal(response.statusCode, 200, query.pathname + query.search);
    const body = response.json();
    const expectedPage = expected.slice(offset, offset + limit);
    const hasMore = offset + expectedPage.length < expected.length;
    assert.deepEqual(body.data, expectedPage);
    assert.equal(body.meta.total, expected.length);
    assert.deepEqual(body.meta.pagination, {
      limit, offset, count: expectedPage.length,
      has_more: hasMore,
      next_offset: hasMore ? offset + expectedPage.length : null,
    });
    records.push(...body.data);
    if (!hasMore) break;
    offset = body.meta.pagination.next_offset;
  }
  assert.deepEqual(records, expected);
}

describe("Maritime API", () => {
  it("serves ports separately from lighthouses with source metadata", async () => {
    const ports = await app.inject("/api/v1/ports");
    assert.equal(ports.statusCode, 200);
    const portBody = ports.json();
    assert.equal(portBody.data.length, 48);
    assert.equal(portBody.meta.total, 48);
    assert.equal(portBody.meta.dataset, "morocco-ports");
    assert.equal(portBody.meta.license, "ODbL-1.0");
    assert.equal(portBody.meta.sources[0].dataset, "Liste des ports au Royaume du Maroc");
    assert.ok(portBody.data.every((row: Record<string, unknown>) => "Nom du port" in row && !("Nom" in row)));
    assert.deepEqual(portBody.data, portRecords.slice(0, 100));
    assert.deepEqual(portBody.meta.pagination, {
      limit: 100, offset: 0, count: 48, has_more: false, next_offset: null,
    });

    const lighthouses = await app.inject("/api/v1/lighthouses");
    assert.equal(lighthouses.statusCode, 200);
    const lighthouseBody = lighthouses.json();
    assert.equal(lighthouseBody.data.length, 39);
    assert.equal(lighthouseBody.meta.total, 39);
    assert.equal(lighthouseBody.meta.dataset, "morocco-lighthouses");
    assert.equal(lighthouseBody.meta.sources[0].dataset, "Liste des phares au Royaume du Maroc");
    assert.ok(lighthouseBody.data.every((row: Record<string, unknown>) => "Nom" in row && !("Nom du port" in row)));
    assert.deepEqual(lighthouseBody.data, lighthouseRecords.slice(0, 100));
    assert.deepEqual(lighthouseBody.meta.pagination, {
      limit: 100, offset: 0, count: 39, has_more: false, next_offset: null,
    });
  });

  it("reconstructs both complete datasets through successive pages without losing source fields", async () => {
    await assertPages("/api/v1/ports", portRecords, 7);
    await assertPages("/api/v1/lighthouses", lighthouseRecords, 7);
  });

  it("filters lighthouses before slicing pages and keeps the filtered total", async () => {
    const expected = lighthouseRecords.filter((row) => row.Province === "Al Hoceima");
    assert.equal(expected.length, 2);
    await assertPages("/api/v1/lighthouses?region=TANGER&province=AL%20HOCEIMA", expected, 1);
  });

  it("returns consistent terminal and out-of-range pages", async () => {
    for (const [url, records] of [
      ["/api/v1/ports", portRecords],
      ["/api/v1/lighthouses", lighthouseRecords],
    ] as const) {
      const last = await app.inject(`${url}?limit=1&offset=${records.length - 1}`);
      assert.equal(last.statusCode, 200);
      assert.deepEqual(last.json().data, records.slice(-1));
      assert.deepEqual(last.json().meta.pagination, {
        limit: 1, offset: records.length - 1, count: 1, has_more: false, next_offset: null,
      });
      const outside = await app.inject(`${url}?limit=1&offset=${records.length + 1}`);
      assert.equal(outside.statusCode, 200);
      assert.deepEqual(outside.json().data, []);
      assert.equal(outside.json().meta.total, records.length);
      assert.deepEqual(outside.json().meta.pagination, {
        limit: 1, offset: records.length + 1, count: 0, has_more: false, next_offset: null,
      });
    }
    const noMatches = await app.inject("/api/v1/lighthouses?province=missing-province&limit=1");
    assert.equal(noMatches.statusCode, 200);
    assert.deepEqual(noMatches.json().data, []);
    assert.equal(noMatches.json().meta.total, 0);
    assert.deepEqual(noMatches.json().meta.pagination, {
      limit: 1, offset: 0, count: 0, has_more: false, next_offset: null,
    });
  });

  it("uses default pagination values when only one parameter is supplied", async () => {
    for (const [url, records] of [
      ["/api/v1/ports", portRecords],
      ["/api/v1/lighthouses", lighthouseRecords],
    ] as const) {
      const limitOnly = await app.inject(`${url}?limit=1`);
      assert.equal(limitOnly.statusCode, 200);
      assert.deepEqual(limitOnly.json().data, records.slice(0, 1));
      assert.deepEqual(limitOnly.json().meta.pagination, {
        limit: 1, offset: 0, count: 1, has_more: true, next_offset: 1,
      });
      const offsetOnly = await app.inject(`${url}?offset=1`);
      assert.equal(offsetOnly.statusCode, 200);
      assert.deepEqual(offsetOnly.json().data, records.slice(1, 101));
      assert.deepEqual(offsetOnly.json().meta.pagination, {
        limit: 100, offset: 1, count: records.length - 1, has_more: false, next_offset: null,
      });
    }
  });

  it("rejects invalid pagination on both collections with the documented error schema", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const ajv = new Ajv({ strict: false, allErrors: true });
    for (const path of ["/api/v1/ports", "/api/v1/lighthouses"]) {
      const schema = spec.paths[path].get.responses["400"]?.content?.["application/json"]?.schema;
      assert.ok(schema, `${path}: HTTP 400 must be documented`);
      const validate = ajv.compile(schema);
      for (const query of ["limit=0", "limit=501", "offset=-1", "limit=Infinity", "offset=1e309"]) {
        const response = await app.inject(`${path}?${query}`);
        assert.equal(response.statusCode, 400, `${path}?${query}`);
        const error = response.json();
        assert.equal(error.error.code, "VALIDATION_ERROR");
        assert.ok(validate(error), JSON.stringify(validate.errors));
      }
    }
  });

  it("documents separate endpoint schemas and the Maritime tag in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    assert.deepEqual(spec.paths["/api/v1/ports"].get.tags, ["Maritime"]);
    assert.deepEqual(spec.paths["/api/v1/lighthouses"].get.tags, ["Maritime"]);
    assert.ok(spec.paths["/api/v1/ports"].get.responses["200"]);
    assert.ok(spec.paths["/api/v1/lighthouses"].get.responses["200"]);
  });

  it("looks up a port by case- and accent-insensitive name", async () => {
    for (const name of ["Casablanca", "CASABLANCA"]) {
      const response = await app.inject(`/api/v1/ports/${name}`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data["Nom du port"], "Casablanca");
      assert.equal(response.json().meta.total, 1);
    }
    const accented = await app.inject("/api/v1/ports/Chmaala");
    assert.equal(accented.statusCode, 200);
    assert.equal(accented.json().data["Nom du port"], "Chmaâla");
    assert.equal((await app.inject("/api/v1/ports/unknown-port")).statusCode, 404);
    for (const name of ["x", "%20%20"]) {
      const response = await app.inject(`/api/v1/ports/${name}`);
      assert.equal(response.statusCode, 400);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });

  it("combines lighthouse name, region, province, type and ville filters", async () => {
    const response = await app.inject("/api/v1/lighthouses?name=ras%20tarf&region=tanger&province=al%20hoceima&type=jalonnement&ville=al%20hoceima");
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 1);
    assert.equal(response.json().data[0].Nom, "Ras Tarf (Cabo Quilates)");
    assert.deepEqual(response.json().meta.pagination, {
      limit: 100, offset: 0, count: 1, has_more: false, next_offset: null,
    });

    const accent = await app.inject("/api/v1/lighthouses?ville=Tétouan");
    assert.equal(accent.statusCode, 200);
    assert.ok(accent.json().meta.total > 0);
    assert.ok(accent.json().data.every((row: { Ville: string }) => row.Ville.includes("Tétouan")));

    const empty = await app.inject("/api/v1/lighthouses?region=missing-region");
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().meta.total, 0);
  });

  it("enforces each lighthouse filter's normalized two-character minimum and maximum", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const operation = spec.paths["/api/v1/lighthouses"].get;
    const schema = operation.responses["400"]?.content?.["application/json"]?.schema;
    assert.ok(schema);
    const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
    for (const filter of ["name", "region", "province", "type", "ville"]) {
      const parameter = operation.parameters.find((item: { name: string }) => item.name === filter);
      assert.equal(parameter.schema.minLength, 2, filter);
      assert.equal(parameter.schema.maxLength, 100, filter);
      assert.match(parameter.description, /after search normalization/, filter);
      for (const value of ["", "  ", "x", "x ", "e\u0301", "\u0301\u0301", "\u0640\u0640", "x".repeat(101)]) {
        const response = await app.inject(`/api/v1/lighthouses?${filter}=${encodeURIComponent(value)}`);
        assert.equal(response.statusCode, 400, `${filter}: ${JSON.stringify(value)}`);
        const error = response.json();
        assert.equal(error.error.code, "VALIDATION_ERROR");
        assert.ok(validate(error), JSON.stringify(validate.errors));
      }
      const valid = await app.inject(`/api/v1/lighthouses?${filter}=zz`);
      assert.equal(valid.statusCode, 200, `${filter}: a two-character filter is valid`);
      const validMaximum = await app.inject(`/api/v1/lighthouses?${filter}=${"x".repeat(100)}`);
      assert.equal(validMaximum.statusCode, 200, `${filter}: the 100-character boundary is valid`);
    }
  });

  it("documents port detail and lighthouse filters in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const detail = spec.paths["/api/v1/ports/{name}"].get;
    assert.deepEqual(detail.tags, ["Maritime"]);
    assert.ok(detail.responses["200"] && detail.responses["400"] && detail.responses["404"]);
    const lighthouseList = spec.paths["/api/v1/lighthouses"].get;
    assert.deepEqual(lighthouseList.parameters.map((parameter: { name: string }) => parameter.name).sort(), ["limit", "name", "offset", "province", "region", "type", "ville"]);
    const portList = spec.paths["/api/v1/ports"].get;
    assert.deepEqual(portList.parameters.map((parameter: { name: string }) => parameter.name).sort(), ["limit", "offset"]);
    for (const list of [portList, lighthouseList]) {
      assert.ok(list.responses["400"]);
      const parameters = Object.fromEntries(list.parameters.map((parameter: { name: string; schema: unknown }) => [parameter.name, parameter.schema]));
      assert.deepEqual(parameters.limit, {
        type: "integer", minimum: 1, maximum: 500, default: 100,
      });
      assert.deepEqual(parameters.offset, {
        type: "integer", minimum: 0, maximum: 2_147_483_647, default: 0,
      });
      const metadata = list.responses["200"].content["application/json"].schema.properties.meta;
      assert.ok(metadata.required.includes("pagination"));
    }
  });
});
