import type { FastifyPluginAsync } from "fastify";
import type { ApiDocument } from "./catalog.js";
import { type Language, languages } from "./content.js";
import { renderDocsPage } from "./page.js";
import { docsUrl } from "./urls.js";
import { absoluteUrl } from "../web/seo.js";

export const documentation: FastifyPluginAsync = async (app) => {
  // Build only after all domain plugins have registered their OpenAPI routes.
  const pages = new Map<string, string>();
  const render = (query: { lang?: string; endpoint?: string }) => {
    const language: Language = languages.includes(query.lang as Language) ? query.lang as Language : "fr";
    const spec = app.swagger() as ApiDocument;
    const requested = query.endpoint?.replace(/^\/api\/v1\//, "/api/v2/");
    const endpoint = requested && Object.hasOwn(spec.paths, requested) ? requested : "/api/v2/regions";
    const key = `${language}:${endpoint}`;
    let page = pages.get(key);
    if (!page) {
      page = renderDocsPage(spec, language, endpoint);
      pages.set(key, page);
    }
    return page;
  };
  for (const path of ["/docs", "/docs/"]) {
    app.get<{ Querystring: { lang?: string; endpoint?: string } }>(path, {
      schema: {
        hide: true,
        querystring: { type: "object", properties: { lang: { type: "string", maxLength: 10 }, endpoint: { type: "string", maxLength: 250 } } },
      },
    }, async (request, reply) => reply.type("text/html; charset=utf-8").send(render(request.query)));
  }

  for (const path of ["/docs/:lang", "/docs/:lang/*"]) {
    app.get<{ Params: { lang: string; "*"?: string } }>(path, { schema: { hide: true } }, async (request, reply) => {
      const { lang, "*": resource } = request.params;
      if (!languages.includes(lang as Language)) return reply.callNotFound();
      const endpoint = resource === undefined ? "/api/v2/regions" : Object.keys((app.swagger() as ApiDocument).paths)
        .find((candidate) => docsUrl(lang as Language, candidate) === `/docs/${lang}/${resource}`);
      if (!endpoint) return reply.callNotFound();
      return reply.type("text/html; charset=utf-8").send(render({ lang, endpoint }));
    });
  }

  app.get("/robots.txt", { schema: { hide: true } }, async (_request, reply) => reply
    .type("text/plain; charset=utf-8")
    .send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${absoluteUrl("/sitemap.xml")}\n`));

  app.get("/sitemap.xml", { schema: { hide: true } }, async (_request, reply) => {
    const paths = Object.entries((app.swagger() as ApiDocument).paths).filter(([, item]) => item.get).map(([path]) => path);
    const entries = ["/", "/fr", "/ar", ...paths.flatMap((path) => languages.map((language) => docsUrl(language, path)))];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((path) => `<url><loc>${absoluteUrl(path)}</loc></url>`).join("\n")}\n</urlset>`;
    return reply.type("application/xml; charset=utf-8").header("Cache-Control", "public, max-age=3600").send(xml);
  });
};
