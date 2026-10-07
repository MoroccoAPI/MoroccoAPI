import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
  type FastifyServerOptions,
} from "fastify";

import { geography } from "./geography/routes.js";
import { loadRegions } from "./geography/data/regions.js";
import { loadGeography } from "./geography/data/subdivisions.js";
import { health } from "./health/routes.js";
import { status } from "./status.js";
import { home } from "./home/routes.js";
import { population } from "./population/routes.js";
import { APP_VERSION } from "./version.js";

export async function buildApp(
  options: FastifyServerOptions = { logger: false },
): Promise<FastifyInstance> {
  const loggerOptions = typeof options.logger === "object" ? options.logger : {};
  const app = Fastify({
    ...options,
    ...(options.logger ? {
      logger: {
        ...loggerOptions,
        serializers: {
          ...loggerOptions.serializers,
          req(request: FastifyRequest) {
            // Query values can be credentials; omit them from logs only.
            const queryStart = request.url.indexOf("?");
            return {
              method: request.method,
              url: queryStart < 0 ? request.url : request.url.slice(0, queryStart),
              host: request.host,
              remoteAddress: request.ip,
              ...(request.socket?.remotePort === undefined
                ? {}
                : { remotePort: request.socket.remotePort }),
            };
          },
        },
      },
    } : {}),
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "MoroccoAPI",
        description:
          "Community-maintained access to reusable Moroccan public open data with source and license metadata.",
        version: APP_VERSION,
      },
      tags: [
        { name: "System", description: "Service health and status" },
        {
          name: "Administrative geography",
          description: "Normalized public administrative geography data",
        },
        { name: "Population", description: "Demographic data for Morocco" },
        { name: "Health", description: "Health facilities and infrastructure indicators with source and snapshot metadata" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

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

  const regions = await loadRegions();
  const geographyData = Object.freeze({
    regions,
    ...await loadGeography(regions),
  });

  await app.register(home);
  await app.register(status);
  await app.register(geography, { data: geographyData });
  await app.register(population);
  await app.register(health, { geography: geographyData });

  return app;
}
