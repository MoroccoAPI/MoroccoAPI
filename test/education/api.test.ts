import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { loadEducationSchools } from "../../src/education/data/schools.js";
import { loadUniversityEstablishments } from "../../src/education/data/universities.js";
import { schoolDatasetRoutes } from "../../src/education/types.js";
import type { EducationSchool, UniversityEstablishment } from "../../src/education/types.js";

let app: FastifyInstance;
let schools: readonly EducationSchool[];
let universities: readonly UniversityEstablishment[];

before(async () => {
  schools = await loadEducationSchools();
  universities = await loadUniversityEstablishments();
  app = await buildApp();
  await app.ready();
});

after(async () => {
  await app.close();
});

describe("education datasets", () => {
  for (const config of schoolDatasetRoutes) {
    const url = `/api/v1/education/${config.path}`;

    it(`lists only records from ${config.path} with matching source metadata`, async () => {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 200);
      const body = response.json();
      const expected = schools.filter((school) => school.category === config.category);
      assert.deepEqual(body.data, expected);
      assert.equal(body.meta.dataset, config.dataset);
      assert.equal(body.meta.total, expected.length);
      assert.equal(body.meta.license, "ODbL-1.0");
      assert.equal(body.meta.sources.length, 1);
      assert.equal(new Set(body.data.map((school: EducationSchool) => school.id)).size, expected.length);
      assert.ok(body.data.every((school: EducationSchool) => school.category === config.category));
    });

    it(`filters ${config.path} and retrieves a record by ID`, async () => {
      const expected = schools.find((school) => school.category === config.category);
      assert.ok(expected);
      const filtered = await app.inject(`${url}?region=${encodeURIComponent(expected.region)}&search=${encodeURIComponent(expected.name_fr.slice(0, 5))}`);
      assert.equal(filtered.statusCode, 200);
      assert.ok(filtered.json().data.length > 0);
      assert.ok(filtered.json().data.every((school: EducationSchool) =>
        school.category === config.category && school.region === expected.region));

      const detail = await app.inject(`${url}/${expected.id}`);
      assert.equal(detail.statusCode, 200);
      assert.deepEqual(detail.json().data, expected);
      assert.equal(detail.json().meta.dataset, config.dataset);
      assert.equal(detail.json().meta.total, 1);
    });
  }

  it("lists public university establishments with their own source metadata", async () => {
    const response = await app.inject("/api/v1/education/universites-publiques");
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual(body.data, universities);
    assert.equal(body.meta.dataset, "universites-publiques");
    assert.equal(body.meta.total, universities.length);
    assert.equal(body.meta.sources.length, 1);
    assert.equal(new Set(body.data.map((record: UniversityEstablishment) => record.id)).size, universities.length);
  });

  it("filters and retrieves public university establishments", async () => {
    const expected = universities.find((record) => record.city === "Rabat");
    assert.ok(expected);
    const response = await app.inject(`/api/v1/education/universites-publiques?city=Rabat&search=${encodeURIComponent(expected.abbreviation.slice(0, 3))}`);
    assert.equal(response.statusCode, 200);
    assert.ok(response.json().data.length > 0);
    assert.ok(response.json().data.every((record: UniversityEstablishment) => record.city === "Rabat"));

    const detail = await app.inject(`/api/v1/education/universites-publiques/${expected.id}`);
    assert.equal(detail.statusCode, 200);
    assert.deepEqual(detail.json().data, expected);
    assert.equal(detail.json().meta.dataset, "universites-publiques");
  });

  it("normalizes the source NULL address marker to JSON null", async () => {
    const expected = schools.find((school) => school.name_fr === "alghofrane");
    assert.ok(expected);
    assert.equal(expected.address_fr, null);
    const response = await app.inject(`/api/v1/education/etablissement-prives/${expected.id}`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.address_fr, null);
  });

  it("searches university telephone and fax values", async () => {
    const expected = universities.find((record) => record.telephone === "0537772732");
    assert.ok(expected);
    for (const phone of [expected.telephone, expected.fax]) {
      assert.ok(phone);
      const response = await app.inject(`/api/v1/education/universites-publiques?search=${encodeURIComponent(phone)}`);
      assert.equal(response.statusCode, 200);
      assert.ok(response.json().data.some((record: UniversityEstablishment) => record.id === expected.id));
    }
  });

  it("returns consistent errors for invalid filters and unknown IDs", async () => {
    const invalid = await app.inject("/api/v1/education/etablissement-prives?search=a");
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.json().error.code, "VALIDATION_ERROR");
    assert.equal(typeof invalid.json().error.request_id, "string");

    const missingSchool = await app.inject("/api/v1/education/etablissement-prives/unknown-id");
    assert.equal(missingSchool.statusCode, 404);
    assert.equal(missingSchool.json().error.code, "RESOURCE_NOT_FOUND");

    const missingUniversity = await app.inject("/api/v1/education/universites-publiques/unknown-id");
    assert.equal(missingUniversity.statusCode, 404);
    assert.equal(missingUniversity.json().error.code, "RESOURCE_NOT_FOUND");
  });

  it("documents each dataset-specific path and the descriptive search parameter", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    for (const config of schoolDatasetRoutes) {
      const url = `/api/v1/education/${config.path}`;
      const collection = spec.paths[url].get;
      const detail = spec.paths[`${url}/{id}`].get;
      assert.ok(collection.parameters.some((parameter: { name: string }) => parameter.name === "search"));
      assert.ok(!collection.parameters.some((parameter: { name: string }) => parameter.name === "q"));
      assert.deepEqual(collection.responses["200"].content["application/json"].schema.properties.meta.properties.dataset.enum, [config.dataset]);
      assert.ok(detail.responses["404"]);
    }
    assert.ok(spec.paths["/api/v1/education/universites-publiques"].get.parameters.some(
      (parameter: { name: string }) => parameter.name === "search",
    ));
    const universitySearch = spec.paths["/api/v1/education/universites-publiques"].get.parameters.find(
      (parameter: { name: string }) => parameter.name === "search",
    );
    assert.match(universitySearch.description, /telephone, and fax/);
  });
});
