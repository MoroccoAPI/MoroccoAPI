import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
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

describe("Application contracts", () => {
  it("reads each geography snapshot once when registering Geography and Health", async () => {
    const originalReadFile = fs.readFile;
    const reads = new Map<string, number>();
    let sharedApp: FastifyInstance | undefined;

    fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
      const path = args[0];
      const filename = path instanceof URL ? path.pathname : typeof path === "string" ? path.replaceAll("\\", "/") : "";
      if (filename.includes("/data/geography/")) {
        const name = filename.split("/").at(-1)!;
        reads.set(name, (reads.get(name) ?? 0) + 1);
      }
      return originalReadFile(...args);
    }) as typeof fs.readFile;
    syncBuiltinESMExports();

    try {
      sharedApp = await buildApp();
      await sharedApp.ready();
      assert.deepEqual(Object.fromEntries([...reads].sort()), {
        "administrative-arrondissements.json": 1,
        "administrative-communes.json": 1,
        "administrative-prefectures-of-arrondissements.json": 1,
        "administrative-provinces.json": 1,
        "administrative-regions.json": 1,
      });
      assert.equal((await sharedApp.inject("/api/v1/regions")).statusCode, 200);
      assert.equal((await sharedApp.inject("/api/v1/health/hospitals")).statusCode, 200);
      assert.equal((await sharedApp.inject("/api/v1/health/primary-care-facilities")).statusCode, 200);
      assert.equal((await sharedApp.inject("/api/v1/health/private-infrastructure")).statusCode, 200);
    } finally {
      fs.readFile = originalReadFile;
      syncBuiltinESMExports();
      await sharedApp?.close();
    }
  });

  it("keeps query values and credential headers out of logs without changing requests", async () => {
    const logs: string[] = [];
    const loggedApp = await buildApp({
      logger: {
        level: "info",
        stream: {
          write(line: string) {
            logs.push(line);
          },
        },
      },
    });
    const token = "logging-test-token";
    const key = "logging-test-key";
    const authorization = "logging-test-authorization";
    const cookie = "logging-test-cookie";

    try {
      const search = await loggedApp.inject({
        method: "GET",
        url: `/api/v1/locations/search?q=kenitra&token=${token}&key=${key}`,
        headers: { authorization: `Bearer ${authorization}`, cookie: `session=${cookie}` },
      });
      assert.equal(search.statusCode, 200);
      assert.equal(search.json().data[0].code, "rabat-sale-kenitra");

      for (const [url, statusCode] of [
        [`/api/v1/status?%74oken=${token}&TOKEN=${token}&key=${key}&key=${key}`, 200],
        [`/api/v1/locations/search?q=a&token=${token}&key=${key}`, 400],
        [`/does-not-exist?token=${token}&key=${key}`, 404],
        [`/docs/does-not-exist?token=${token}&key=${key}`, 404],
        [`/docs/static/does-not-exist.js?token=${token}&key=${key}`, 404],
        [`/api/v1/regions/%zz?token=${token}&key=${key}`, 400],
      ] as const) {
        const response = await loggedApp.inject({ method: "GET", url });
        assert.equal(response.statusCode, statusCode, url);
      }

      const output = logs.join("");
      for (const value of [token, key, authorization, cookie]) {
        assert.ok(!output.includes(value), "Credential values must not appear in logs");
      }
      const entries = logs.map((line) => JSON.parse(line));
      const requestEntry = entries.find((entry) => entry.req?.url === "/api/v1/locations/search");
      assert.ok(requestEntry, "Requests must still be logged with their path");
      assert.equal(requestEntry.req.method, "GET");
      assert.ok(entries.some((entry) => entry.res?.statusCode === 200));
    } finally {
      await loggedApp.close();
    }
  });

  it("reports the package version consistently on the homepage, status, and OpenAPI", async () => {
    const packageInfo = JSON.parse(
      await readFile(new URL("../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    const status = (await app.inject("/api/v1/status")).json();
    const spec = (await app.inject("/openapi.json")).json();
    const page = await app.inject("/");
    assert.equal(status.data.version, packageInfo.version);
    assert.equal(spec.info.version, packageInfo.version);
    assert.ok(page.body.includes(`v${packageInfo.version}`));
  });

  it("publishes an OpenAPI document for the public routes", async () => {
    const response = await app.inject({ method: "GET", url: "/openapi.json" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.info.title, "MoroccoAPI");
    assert.ok(body.paths["/api/v1/regions"]);
    const subdivisionsRoute = body.paths["/api/v1/regions/{code}/subdivisions"];
    assert.ok(subdivisionsRoute?.get);
    assert.ok(subdivisionsRoute.get.responses["200"]);
    assert.ok(subdivisionsRoute.get.responses["404"]);
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
