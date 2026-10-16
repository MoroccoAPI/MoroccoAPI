import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
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
import { postal } from "./postal/routes.js";
import { worldBank } from "./world-bank/routes.js";
import { APP_VERSION } from "./version.js";
import { telecom } from "./telecom/routes.js";
import { education } from "./education/routes.js";
import { holidays } from "./holidays/routes.js";
import { airports } from "./airports/routes.js";
import { museums } from "./museums/routes.js";
import { maritime } from "./maritime/routes.js";
import { dams } from "./dams/routes.js";

const publicCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "X-MoroccoAPI-Revision",
} as const;

export async function buildApp(
  options: FastifyServerOptions = { logger: false },
): Promise<FastifyInstance> {
  const loggerOptions = typeof options.logger === "object" ? options.logger : {};
  const app = Fastify({
    ...options,
    routerOptions: {
      ...options.routerOptions,
      maxParamLength: options.routerOptions?.maxParamLength ?? options.maxParamLength ?? 200,
    },
    frameworkErrors: options.frameworkErrors ?? ((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;
      const isClientError = statusCode < 500;
      let message = "An internal error occurred";
      if (isClientError) {
        message = error.code === "FST_ERR_BAD_URL"
          ? "The requested URL is malformed"
          : error.code === "FST_ERR_MAX_PARAM_LENGTH"
            ? "A URL parameter exceeds the maximum length"
            : "The request could not be processed";
      } else {
        request.log.error(error);
      }
      return reply.headers(publicCorsHeaders).code(statusCode).send({
        error: {
          code: isClientError ? "REQUEST_ERROR" : "INTERNAL_ERROR",
          message,
          request_id: request.id,
        },
      });
    }),
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

  // Reject malformed preflights with the same JSON envelope as other client errors.
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS" &&
      (!request.headers.origin || !request.headers["access-control-request-method"])) {
      return reply.headers(publicCorsHeaders).code(400).send({ error: {
        code: "VALIDATION_ERROR",
        message: "CORS preflight requires Origin and Access-Control-Request-Method headers",
        request_id: request.id,
      } });
    }
  });
  await app.register(cors, {
    origin: publicCorsHeaders["Access-Control-Allow-Origin"],
    methods: ["GET", "HEAD"],
    credentials: false,
    exposedHeaders: publicCorsHeaders["Access-Control-Expose-Headers"],
  });

  await app.register(swagger, {
    transformObject: (document) => "openapiObject" in document
      ? toOpenApi30(document.openapiObject)
      : document.swaggerObject,
    openapi: {
      openapi: "3.0.3",
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
        { name: "Education", description: "Public and private schools and public university establishments" },
        { name: "Telecom", description: "Local phone formatting and licensed carrier and geographic prefix mappings" },
        { name: "Holidays", description: "Moroccan public holidays and business days with confirmation status" },
        { name: "Airports", description: "OurAirports MA directory with codes, municipalities and source coordinates" },
        { name: "Museums", description: "FNM September 2026 museum inventory with visitor information and source metadata" },
        { name: "Postal codes", description: "Poste Maroc postal codes for localities and city neighbourhoods (September 2018 snapshot), linked to administrative geography" },
        { name: "World Bank", description: "World Bank development indicators for Morocco (international estimates, CC BY 4.0)" },
        { name: "Maritime", description: "Ports and lighthouses from the Ministry of Equipment and Water" },
        { name: "Water", description: "Historical dam storage observations with source and license metadata" },
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
    if (error.validation || error.code === "VALIDATION_ERROR") {
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
  await app.register(population, { geography: geographyData });
  await app.register(health, { geography: geographyData });
  await app.register(telecom);
  await app.register(education);
  await app.register(holidays);
  await app.register(airports);
  await app.register(museums, { geography: geographyData });
  await app.register(maritime);
  await app.register(postal, { geography: geographyData });
  await app.register(worldBank);
  await app.register(dams);

  return app;
}

/** Keep documentation null types compatible with OpenAPI 3.0. */
function toOpenApi30<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(toOpenApi30) as T;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;
  const converted = Object.fromEntries(Object.entries(record).map(([key, child]) => [
    key,
    // Preserve literal data in annotations and enum values.
    ["default", "enum", "example", "examples"].includes(key) ? child : toOpenApi30(child),
  ]));

  if (record.type === "null") {
    return { ...converted, type: "string", nullable: true, enum: [null] } as T;
  }
  return converted as T;
}
