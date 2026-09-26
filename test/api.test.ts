import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../src/app.js";

let app: FastifyInstance;

before(async () => {
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("MoroccoAPI", () => {
  it("reports service health", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/status" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.status, "ok");
    assert.equal(body.data.service, "MoroccoAPI");
    assert.match(body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof body.meta.request_id, "string");
  });

  it("returns exactly 12 regions with unique MoroccoAPI codes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/regions" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 12);
    assert.equal(body.meta.total, 12);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(body.meta.sources.length, 1);

    const codes = body.data.map((region: { code: string }) => region.code);
    const hcpCodes = body.data.map(
      (region: { hcp_code: string }) => region.hcp_code,
    );
    assert.equal(new Set(codes).size, 12);
    assert.equal(new Set(hcpCodes).size, 12);
  });

  it("returns one region by code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/regions/casablanca-settat",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.hcp_code, "06");
    assert.equal(body.data.name.ar, "الدار البيضاء-سطات");
    assert.equal(body.data.name.fr, "Casablanca-Settat");
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when a region is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/regions/unknown-region",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("returns all 75 provinces and prefectures with unique codes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/provinces" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 75);
    assert.equal(body.meta.total, 75);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(body.meta.retrieved_at, "2026-09-26");
    assert.equal(
      body.meta.sources[0].producer,
      "Haut-Commissariat au Plan (HCP)",
    );

    const codes = body.data.map((province: { code: string }) => province.code);
    const hcpCodes = body.data.map(
      (province: { hcp_code: string }) => province.hcp_code,
    );
    assert.equal(new Set(codes).size, 75);
    assert.equal(new Set(hcpCodes).size, 75);
    assert.equal(
      body.data.filter(
        (province: { administrative_type: string }) =>
          province.administrative_type === "province",
      ).length,
      62,
    );
    assert.equal(
      body.data.filter(
        (province: { administrative_type: string }) =>
          province.administrative_type === "prefecture",
      ).length,
      13,
    );
  });

  it("returns one province by code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/provinces/azilal",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.name.fr, "Azilal");
    assert.equal(body.data.name.ar, "أزيلال");
    assert.equal(body.data.hcp_code, "05.081");
    assert.equal(body.data.administrative_type, "province");
    assert.equal(body.data.region_code, "beni-mellal-khenifra");
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when a province is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/provinces/unknown-province",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("returns Casablanca's eight prefectures of arrondissements", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/prefectures-of-arrondissements",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 8);
    assert.equal(body.meta.total, 8);
    assert.equal(
      new Set(body.data.map((item: { code: string }) => item.code)).size,
      8,
    );
    assert.equal(
      new Set(body.data.map((item: { hcp_code: string }) => item.hcp_code)).size,
      8,
    );
    assert.ok(
      body.data.every(
        (item: { province_code: string }) => item.province_code === "casablanca",
      ),
    );
  });

  it("returns one prefecture of arrondissements by code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/prefectures-of-arrondissements/casablanca--prefecture-of-arrondissements--casablanca-anfa",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.hcp_code, "06.141.01.00");
    assert.equal(body.data.name.ar, "الدار البيضاء-أنفا");
    assert.equal(body.data.name.fr, "Casablanca-Anfa");
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when a prefecture of arrondissements is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/prefectures-of-arrondissements/casablanca--unknown-prefecture",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("returns all 1503 communes with unique composite codes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/communes" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 1503);
    assert.equal(body.meta.total, 1503);
    assert.equal(body.meta.license, "CC-BY-4.0");
    assert.equal(body.meta.retrieved_at, "2026-09-26");

    const codes = body.data.map((commune: { code: string }) => commune.code);
    const hcpCodes = body.data.map(
      (commune: { hcp_code: string }) => commune.hcp_code,
    );
    assert.equal(new Set(codes).size, 1503);
    assert.equal(new Set(hcpCodes).size, 1503);
    assert.ok(
      body.data.every(
        (commune: { name: { ar: string } }) => commune.name.ar.length > 0,
      ),
    );
    assert.ok(codes.includes("casablanca--mechouar-de-casablanca"));
    assert.ok(!codes.includes("casablanca--ain-chock"));
    assert.ok(!codes.includes("m-diq-fnideq--sebta"));
    assert.ok(!codes.includes("nador--melilia"));

    const ouladAissa = body.data.filter(
      (commune: { name: { fr: string } }) => commune.name.fr === "Oulad Aissa",
    );
    assert.deepEqual(
      ouladAissa.map((commune: { code: string }) => commune.code).sort(),
      [
        "el-jadida--oulad-aissa",
        "khouribga--oulad-aissa",
        "taroudannt--oulad-aissa",
      ],
    );
  });

  it("returns one commune by its province-qualified code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/communes/azilal--afourar",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.name.fr, "Afourar");
    assert.equal(body.data.name.ar, "أفورار");
    assert.equal(body.data.hcp_code, "05.081.11.01");
    assert.equal(body.data.cercle_hcp_code, "05.081.11");
    assert.equal(body.data.province_code, "azilal");
    assert.equal(body.data.region_code, "beni-mellal-khenifra");
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when a commune is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/communes/azilal--unknown-commune",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("returns all 41 arrondissements with their parent communes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/arrondissements",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.length, 41);
    assert.equal(body.meta.total, 41);
    assert.equal(new Set(body.data.map((item: { code: string }) => item.code)).size, 41);
    assert.equal(
      new Set(body.data.map((item: { hcp_code: string }) => item.hcp_code)).size,
      41,
    );
    assert.ok(
      body.data.every(
        (item: { name: { ar: string } }) => item.name.ar.length > 0,
      ),
    );
    assert.deepEqual(
      new Set(body.data.map((item: { commune_code: string }) => item.commune_code)),
      new Set([
        "casablanca--casablanca",
        "fes--fes",
        "marrakech--marrakech",
        "rabat--rabat",
        "sale--sale",
        "tanger-assilah--tanger",
      ]),
    );
    assert.equal(
      body.data.filter(
        (item: { prefecture_of_arrondissements_code: string | null }) =>
          item.prefecture_of_arrondissements_code !== null,
      ).length,
      16,
    );
  });

  it("returns one arrondissement by code", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/arrondissements/casablanca--ain-chock",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.data.name.fr, "Aïn-Chock");
    assert.equal(body.data.name.ar, "عين الشق");
    assert.equal(body.data.hcp_code, "06.141.01.41");
    assert.equal(body.data.commune_code, "casablanca--casablanca");
    assert.equal(
      body.data.prefecture_of_arrondissements_code,
      "casablanca--prefecture-of-arrondissements--ain-chock",
    );
    assert.equal(body.meta.total, 1);
  });

  it("returns a stable error when an arrondissement is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/arrondissements/casablanca--unknown-arrondissement",
    });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("keeps MoroccoAPI and HCP codes unique across published administrative levels", async () => {
    const urls = [
      "/api/v1/regions",
      "/api/v1/provinces",
      "/api/v1/prefectures-of-arrondissements",
      "/api/v1/communes",
      "/api/v1/arrondissements",
    ];
    const responses = await Promise.all(
      urls.map((url) => app.inject({ method: "GET", url })),
    );
    const records = responses.flatMap((response) => response.json().data);
    const codes = records.map((record: { code: string }) => record.code);
    const hcpCodes = records.map(
      (record: { hcp_code: string }) => record.hcp_code,
    );

    assert.equal(new Set(codes).size, records.length);
    assert.equal(new Set(hcpCodes).size, records.length);
  });

  it("searches names without requiring French accents", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=kenitra",
    });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.meta.total, 1);
    assert.equal(body.data[0].code, "rabat-sale-kenitra");
  });

  it("searches Arabic names", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=%D8%A7%D9%84%D8%B4%D8%B1%D9%82",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data[0].code, "oriental");
  });

  it("normalizes Arabic alef variants, diacritics, and tatweel", async () => {
    for (const query of ["اسفي", "مَرَّاكُش", "مـراكش"]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/locations/search?q=${encodeURIComponent(query)}`,
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.json().meta.total, 1);
      assert.equal(response.json().data[0].code, "marrakech-safi");
    }
  });

  it("rejects invalid search queries", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=a",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, "VALIDATION_ERROR");

    const whitespaceResponse = await app.inject({
      method: "GET",
      url: "/api/v1/locations/search?q=%20%20",
    });
    assert.equal(whitespaceResponse.statusCode, 400);
    assert.equal(whitespaceResponse.json().error.code, "VALIDATION_ERROR");
  });

  it("publishes an OpenAPI document for the public routes", async () => {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.info.title, "MoroccoAPI");
    assert.ok(body.paths["/api/v1/regions"]);
    assert.ok(body.paths["/api/v1/provinces"]);
    assert.ok(body.paths["/api/v1/provinces/{code}"]);
    assert.ok(body.paths["/api/v1/prefectures-of-arrondissements"]);
    assert.ok(body.paths["/api/v1/prefectures-of-arrondissements/{code}"]);
    assert.ok(body.paths["/api/v1/communes"]);
    assert.ok(body.paths["/api/v1/communes/{code}"]);
    assert.ok(body.paths["/api/v1/arrondissements"]);
    assert.ok(body.paths["/api/v1/arrondissements/{code}"]);
    assert.ok(body.paths["/api/v1/locations/search"]);
  });

  it("returns a consistent error for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/does-not-exist" });
    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.code, "ROUTE_NOT_FOUND");
  });
});
