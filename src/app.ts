import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";

import { loadRegions } from "./data/regions.js";
import { registerRegionRoutes } from "./routes/regions.js";
import { registerStatusRoutes } from "./routes/status.js";

export async function buildApp(
  options: FastifyServerOptions = { logger: false },
): Promise<FastifyInstance> {
  const app = Fastify(options);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "MoroccoAPI",
        description:
          "Community-maintained access to reusable Moroccan public open data with source and license metadata.",
        version: "0.1.0",
      },
      tags: [
        { name: "System", description: "Service health and status" },
        {
          name: "Administrative geography",
          description: "Normalized public administrative geography data",
        },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  const regions = await loadRegions();
  await registerStatusRoutes(app);
  await registerRegionRoutes(app, regions);

  app.get(
    "/openapi.json",
    {
      schema: {
        hide: true,
        response: { 200: { type: "object", additionalProperties: true } },
      },
    },
    async () => app.swagger(),
  );

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist",
        request_id: request.id,
      },
    }),
  );

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: error.message,
          request_id: request.id,
        },
      });
    }

    request.log.error(error);
    return reply.code(error.statusCode ?? 500).send({
      error: {
        code: error.statusCode && error.statusCode < 500 ? "REQUEST_ERROR" : "INTERNAL_ERROR",
        message: error.statusCode && error.statusCode < 500 ? error.message : "An internal error occurred",
        request_id: request.id,
      },
    });
  });

  return app;
}
