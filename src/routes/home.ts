import { readFile } from "node:fs/promises";

import type { FastifyInstance } from "fastify";

import { renderHomePage } from "../pages/home.js";

export async function registerHomeRoutes(app: FastifyInstance): Promise<void> {
  const logo = await readFile(
    new URL("../../assets/brand/moroccoapi-logo.png", import.meta.url),
  );
  const homePage = renderHomePage();

  app.get("/", { schema: { hide: true } }, async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(homePage),
  );

  app.get(
    "/assets/moroccoapi-logo.png",
    { schema: { hide: true } },
    async (_request, reply) =>
      reply
        .header("Cache-Control", "public, max-age=3600")
        .type("image/png")
        .send(logo),
  );
}
