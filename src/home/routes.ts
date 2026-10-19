import { readFile } from "node:fs/promises";

import type { FastifyPluginAsync } from "fastify";

import { renderHomePage } from "./page.js";
import { homeUrl } from "./content.js";

export const home: FastifyPluginAsync = async (app) => {
  const logo = await readFile(
    new URL("../../assets/brand/moroccoapi-logo.png", import.meta.url),
  );
  for (const language of ["en", "fr", "ar"] as const) {
    const homePage = renderHomePage(language);
    app.get(homeUrl(language), { schema: { hide: true } }, async (_request, reply) =>
      reply.type("text/html; charset=utf-8").send(homePage),
    );
  }

  app.get(
    "/assets/moroccoapi-logo.png",
    { schema: { hide: true } },
    async (_request, reply) =>
      reply
        .header("Cache-Control", "public, max-age=3600")
        .type("image/png")
        .send(logo),
  );
};
