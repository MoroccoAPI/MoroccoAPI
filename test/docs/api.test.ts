import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Script } from "node:vm";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";
import { buildCatalog, type ApiDocument } from "../../src/docs/catalog.js";
import { client } from "../../src/docs/client.js";
import { examples, groups, languages, titles } from "../../src/docs/content.js";
import { renderDocsPage } from "../../src/docs/page.js";
import { docsUrl } from "../../src/docs/urls.js";
import { themeClient, themeInit } from "../../src/web/theme.js";
import { runInNewContext } from "node:vm";
import { responseFields } from "../../src/docs/fields.js";

let app: FastifyInstance;
let spec: ApiDocument;
before(async () => {
  app = await buildApp();
  await app.ready();
  spec = (await app.inject("/openapi.json")).json();
});
after(async () => { await app.close(); });

describe("documentation", () => {
  it("serves all three languages with the correct reading direction and a preserved API reference", async () => {
    for (const language of languages) {
      const response = await app.inject(`/docs?lang=${language}`);
      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"] ?? "", /^text\/html/);
      assert.ok(response.body.includes(`<html lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}">`));
      assert.match(response.body, /id="request-form"/);
      assert.match(response.body, /href="\/openapi.json"/);
      assert.ok(!response.body.includes("swagger-ui"));
    }
    assert.match((await app.inject("/docs/")).body, /<html lang="fr"/);
    assert.match((await app.inject("/docs?lang=unknown")).body, /<html lang="fr"/);
    assert.equal(spec.paths["/docs"], undefined);
    assert.equal(spec.paths["/docs/"], undefined);
    assert.equal((await app.inject("/docs/static/swagger-ui.js")).statusCode, 404);
  });

  it("covers every public GET operation with translations and its actual parameter schema", () => {
    const paths = Object.entries(spec.paths).filter(([, item]) => item.get).map(([path]) => path);
    for (const language of languages) {
      const catalog = buildCatalog(spec, language);
      assert.deepEqual(catalog.map((endpoint) => endpoint.path).sort(), paths.toSorted());
      for (const endpoint of catalog) {
        assert.ok(titles[endpoint.shortPath], `Translate ${endpoint.path}`);
        assert.ok(Object.hasOwn(groups, endpoint.group), `Translate group ${endpoint.group}`);
        assert.ok(endpoint.title && endpoint.note);
        assert.deepEqual(endpoint.parameters.map(({ name }) => name), spec.paths[endpoint.path]!.get!.parameters?.map(({ name }) => name) ?? []);
        assert.ok(endpoint.parameters.every((parameter) => parameter.help !== parameter.name), endpoint.path);
      }
    }
  });

  it("provides working request examples for every endpoint", async () => {
    for (const endpoint of buildCatalog(spec, "en")) {
      let path = endpoint.path;
      const query = new URLSearchParams();
      for (const parameter of endpoint.parameters) {
        if (parameter.in === "path") {
          assert.ok(examples[endpoint.shortPath]?.[parameter.name], endpoint.path);
          path = path.replace(`{${parameter.name}}`, encodeURIComponent(parameter.value));
        } else if (parameter.value !== "") query.set(parameter.name, parameter.value);
      }
      const url = `${path}${query.size ? `?${query}` : ""}`;
      const result = await app.inject(url);
      assert.equal(result.statusCode, 200, `${url}: ${result.body}`);
      assert.ok(path.startsWith("/api/v2/"));
      const legacyUrl = url.replace("/api/v2/", "/api/v1/");
      const legacy = await app.inject(legacyUrl);
      assert.equal(legacy.statusCode, 200, legacyUrl);
      assert.equal(legacy.headers.link, `<${url}>; rel="successor-version"`);
      assert.ok(legacy.headers["x-moroccoapi-deprecated"]);
      if (endpoint.shortPath !== "/status") assert.deepEqual(legacy.json(), result.json(), legacyUrl);
      assert.equal(result.headers["x-moroccoapi-deprecated"], undefined);
    }
  });

  it("documents every nested success and error field in all languages, with contextual meanings", () => {
    for (const language of languages) {
      for (const endpoint of buildCatalog(spec, language)) {
        assert.ok(endpoint.path.startsWith("/api/v2/"));
        for (const schema of [endpoint.response, endpoint.errorResponse]) {
          const fields = responseFields(schema, spec, endpoint, language);
          for (const field of fields) {
            assert.ok(field.meaning, `${language} ${endpoint.path}: ${field.path}`);
          }
        }
      }
    }
    const catalog = buildCatalog(spec, "en");
    const population = catalog.find((endpoint) => endpoint.shortPath === "/population/national")!;
    const fields = responseFields(population.response, spec, population, "en");
    assert.match(fields.find((field) => field.path === "data.total")!.meaning!, /residents/);
    assert.match(fields.find((field) => field.path === "meta.total")!.meaning!, /records/);
    const dams = catalog.find((endpoint) => endpoint.shortPath === "/dams/{id}/levels")!;
    const damFields = responseFields(dams.response, spec, dams, "en");
    for (const path of ["data[].source_ref.sheet", "data[].source_ref.row", "data[].source_ref.basin_code", "data[].source_ref.dam_index"]) {
      assert.ok(damFields.find((field) => field.path === path)?.meaning, path);
    }
  });

  it("supports legacy HEAD and documentation links while publishing only v2 paths", async () => {
    assert.ok(Object.keys(spec.paths).every((path) => path.startsWith("/api/v2/")));
    const head = await app.inject({ method: "HEAD", url: "/api/v1/regions?limit=2" });
    assert.equal(head.statusCode, 200);
    assert.equal(head.body, "");
    assert.equal(head.headers.link, '</api/v2/regions?limit=2>; rel="successor-version"');
    const legacy = await app.inject("/docs?lang=ar&endpoint=%2Fapi%2Fv1%2Fpostal-codes");
    assert.ok(legacy.body.includes('rel="canonical" href="https://moroccoapi.dev/docs/ar/postal-codes"'));
    assert.match(legacy.body, /<code>API v2<\/code>/);
  });

  it("keeps endpoint selection when changing language and safely handles untrusted text", async () => {
    const endpoint = "/api/v2/postal-codes";
    const page = await app.inject(`/docs?lang=ar&endpoint=${encodeURIComponent(endpoint)}`);
    assert.ok(page.body.includes("البحث عن رمز بريدي"));
    assert.ok(page.body.includes('href="/docs/en/postal-codes"'));
    assert.ok(page.body.includes("مرشحاً واحداً على الأقل"));
    const malicious = '</script><script>alert("xss")</script>';
    const safe = renderDocsPage({ paths: { "/api/v2/example": { get: { summary: malicious, parameters: [{ name: "value", in: "query", schema: { default: malicious } }] } } } }, "fr");
    assert.ok(!safe.includes(malicious));
    assert.ok(safe.includes("&lt;/script&gt;"));
    assert.doesNotThrow(() => new Script(client));
  });

  it("serves unique canonical URLs with reciprocal language variants and indexable server-rendered content", async () => {
    const urls = new Set<string>();
    for (const endpoint of buildCatalog(spec, "fr")) {
      for (const language of languages) {
        const url = docsUrl(language, endpoint.path);
        assert.ok(!urls.has(url), `Duplicate documentation URL: ${url}`);
        urls.add(url);
        const response = await app.inject(url);
        assert.equal(response.statusCode, 200, url);
        assert.ok(response.body.includes(`rel="canonical" href="https://moroccoapi.dev${url}"`), url);
        for (const alternate of languages) {
          assert.ok(response.body.includes(`hreflang="${alternate}" href="https://moroccoapi.dev${docsUrl(alternate, endpoint.path)}"`), url);
        }
        assert.equal((response.body.match(/<h1>/g) ?? []).length, 1, url);
        assert.ok(response.body.includes('type="application/ld+json"'), url);
        assert.ok(response.body.includes('property="og:url"'), url);
      }
    }
    const legacy = await app.inject("/docs?lang=ar&endpoint=%2Fapi%2Fv2%2Fpostal-codes");
    assert.ok(legacy.body.includes('rel="canonical" href="https://moroccoapi.dev/docs/ar/postal-codes"'));
    for (const path of ["/docs/es/regions", "/docs/en/missing-resource"]) {
      assert.equal((await app.inject(path)).statusCode, 404, path);
    }
  });

  it("publishes a sitemap of valid canonical pages and crawler instructions without polluting the API contract", async () => {
    const sitemap = await app.inject("/sitemap.xml");
    assert.equal(sitemap.statusCode, 200);
    assert.match(sitemap.headers["content-type"] ?? "", /^application\/xml/);
    const locations = [...sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]!);
    assert.equal(locations.length, 1 + buildCatalog(spec, "en").length * languages.length);
    assert.equal(new Set(locations).size, locations.length);
    assert.ok(locations.every((url) => url.startsWith("https://moroccoapi.dev/") && !url.includes("?")));
    const robots = await app.inject("/robots.txt");
    assert.match(robots.body, /Sitemap: https:\/\/moroccoapi.dev\/sitemap.xml/);
    assert.equal(spec.paths["/sitemap.xml"], undefined);
    assert.equal(spec.paths["/robots.txt"], undefined);

  });

  it("uses system or saved themes, persists changes, and works when storage is unavailable", () => {
    for (const [saved, systemDark, expected] of [[null, true, "dark"], ["light", true, "light"], ["dark", false, "dark"], ["invalid", false, "light"]] as const) {
      const dataset: Record<string, string> = {};
      runInNewContext(themeInit, { document: { documentElement: { dataset } }, localStorage: { getItem: () => saved }, matchMedia: () => ({ matches: systemDark }) });
      assert.equal(dataset.theme, expected);
    }
    const dataset: Record<string, string> = {};
    const listeners: Record<string, () => void> = {};
    let persisted = "";
    const label = { textContent: "" };
    const button = { dataset: { lightLabel: "Light", darkLabel: "Dark" }, setAttribute: () => {}, querySelector: () => label,
      addEventListener: (name: string, callback: () => void) => { listeners[name] = callback; } };
    const context = { document: { documentElement: { dataset }, querySelectorAll: () => [button], querySelector: () => null },
      localStorage: { getItem: () => "light", setItem: (_key: string, value: string) => { persisted = value; } },
      matchMedia: () => ({ matches: true, addEventListener: () => {} }) };
    runInNewContext(themeInit, context);
    runInNewContext(themeClient, context);
    listeners.click!();
    assert.equal(dataset.theme, "dark");
    assert.equal(persisted, "dark");
    assert.equal(label.textContent, "Light");
    context.localStorage.getItem = () => { throw new Error("Storage blocked"); };
    context.localStorage.setItem = () => { throw new Error("Storage blocked"); };
    assert.doesNotThrow(() => { runInNewContext(themeInit, context); runInNewContext(themeClient, context); listeners.click!(); });
  });
});
