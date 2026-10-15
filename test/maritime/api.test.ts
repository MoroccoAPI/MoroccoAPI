import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

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

    const lighthouses = await app.inject("/api/v1/lighthouses");
    assert.equal(lighthouses.statusCode, 200);
    const lighthouseBody = lighthouses.json();
    assert.equal(lighthouseBody.data.length, 39);
    assert.equal(lighthouseBody.meta.total, 39);
    assert.equal(lighthouseBody.meta.dataset, "morocco-lighthouses");
    assert.equal(lighthouseBody.meta.sources[0].dataset, "Liste des phares au Royaume du Maroc");
    assert.ok(lighthouseBody.data.every((row: Record<string, unknown>) => "Nom" in row && !("Nom du port" in row)));
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

    const accent = await app.inject("/api/v1/lighthouses?ville=Tétouan");
    assert.equal(accent.statusCode, 200);
    assert.ok(accent.json().meta.total > 0);
    assert.ok(accent.json().data.every((row: { Ville: string }) => row.Ville.includes("Tétouan")));

    const empty = await app.inject("/api/v1/lighthouses?region=missing-region");
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.json().meta.total, 0);
    for (const filter of ["name", "region", "province", "type", "ville"]) {
      const invalid = await app.inject(`/api/v1/lighthouses?${filter}=%20%20`);
      assert.equal(invalid.statusCode, 400, filter);
      assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
    }
  });

  it("documents port detail and lighthouse filters in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    const detail = spec.paths["/api/v1/ports/{name}"].get;
    assert.deepEqual(detail.tags, ["Maritime"]);
    assert.ok(detail.responses["200"] && detail.responses["400"] && detail.responses["404"]);
    const lighthouseList = spec.paths["/api/v1/lighthouses"].get;
    assert.deepEqual(lighthouseList.parameters.map((parameter: { name: string }) => parameter.name).sort(), ["name", "province", "region", "type", "ville"]);
  });
});
