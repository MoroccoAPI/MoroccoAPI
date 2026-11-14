import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { loadRailDataset } from "../../src/rail/data/stations.js";
import type { Station } from "../../src/rail/types.js";
import { collectAllPages } from "../helpers/pagination.js";

const base = "/api/v2/transport/rail/stations";
let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Rail stations API", () => {
  it("serves bounded pages with dated ODbL attribution and preserves the complete snapshot", async () => {
    const response = await app.inject(base);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], "*");
    const { data, meta } = response.json();
    assert.equal(data.length, 100);
    assert.equal(meta.total, 151);
    assert.equal(meta.license, "ODbL-1.0");
    assert.equal(meta.attribution, "© OpenStreetMap contributors");
    assert.equal(meta.snapshot_at, "2026-11-13T21:22:20Z");
    assert.equal(meta.pagination.next_offset, 100);
    assert.deepEqual((await collectAllPages(app, base)).data, (await loadRailDataset()).records);
    const empty = (await app.inject(`${base}?offset=151`)).json();
    assert.deepEqual(empty.data, []);
    assert.equal(empty.meta.pagination.next_offset, null);
  });

  it("searches French and Arabic names and ignores accents, case and Arabic diacritics", async () => {
    for (const q of ["rabat", "الرباط", "الرِّباط"]) {
      const response = await app.inject(`${base}?q=${encodeURIComponent(q)}`);
      assert.equal(response.statusCode, 200);
      assert.ok(response.json().data.some((s: Station) => s.names.fr === "Gare Rabat Riad"), q);
    }
    const accented = (await app.inject(`${base}?q=${encodeURIComponent("FÈS")}`)).json();
    const unaccented = (await app.inject(`${base}?q=fes`)).json();
    assert.deepEqual(accented.data, unaccented.data);
    assert.ok(accented.meta.total > 0);
    assert.equal((await app.inject(`${base}?q=not-a-station`)).json().meta.total, 0);
  });

  it("combines source city, type and lifecycle filters without treating unknown as active", async () => {
    const city = encodeURIComponent("الرباط");
    const response = await app.inject(`${base}?city=${city}&q=agdal&type=station&status=unknown`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().meta.total, 1);
    assert.equal(response.json().data[0].id, "osm-node-14268003569");
    const construction = (await app.inject(`${base}?status=construction`)).json();
    assert.equal(construction.data[0].id, "osm-node-14008729906");
    assert.equal(construction.data[0].passenger_service, null);
    assert.equal((await app.inject(`${base}?type=halt`)).json().meta.total, 5);
    assert.equal((await app.inject(`${base}?city=${city}&status=construction`)).json().meta.total, 0);
  });

  it("resolves canonical and reviewed secondary IDs to the same station", async () => {
    const primary = await app.inject(`${base}/osm-node-7055155496`);
    const alias = await app.inject(`${base}/osm-node-12202794581`);
    assert.equal(primary.statusCode, 200);
    assert.deepEqual(primary.json(), alias.json());
    assert.equal(primary.json().meta.total, 1);
    assert.equal(primary.json().data.wikidata_id, "Q2448793");
    const missing = await app.inject(`${base}/osm-node-1`);
    assert.equal(missing.statusCode, 404);
    assert.equal(missing.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("rejects malformed IDs, unknown filters, whitespace and invalid pagination", async () => {
    for (const suffix of [
      "/9300200", "/osm-node-0", "?q=a", "?q=%20%20", "?city=%20%20", "?q=%D9%8E%D9%8E",
      "?status=active", "?type=tram", "?station=Rabat", "?limit=501", "?offset=-1", "?limit=1&limit=2", "?q=a&q=b",
    ]) {
      const response = await app.inject(base + suffix);
      assert.equal(response.statusCode, 400, suffix);
      assert.equal(response.json().error.code, "VALIDATION_ERROR");
    }
  });

  it("registers OpenAPI, v1 compatibility and translated documentation", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    assert.deepEqual(spec.paths[base].get.tags, ["Railway stations"]);
    assert.ok(spec.paths[base + "/{id}"].get.responses["404"]);
    const current = await app.inject(base + "?q=rabat");
    const legacy = await app.inject(base.replace("/v2/", "/v1/") + "?q=rabat");
    assert.deepEqual(current.json(), legacy.json());
    for (const lang of ["fr", "en", "ar"]) {
      assert.equal((await app.inject(`/docs/${lang}/transport/rail/stations`)).statusCode, 200);
    }
  });
});
