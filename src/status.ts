import type { FastifyPluginAsync } from "fastify";

import { APP_REVISION, APP_VERSION } from "./version.js";

export const status: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/v1/status",
    {
      schema: {
        tags: ["System"],
        summary: "Check API health",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: {
                type: "object",
                additionalProperties: false,
                required: ["status", "service", "version", "timestamp"],
                properties: {
                  status: { const: "ok" },
                  service: { const: "MoroccoAPI" },
                  version: { type: "string" },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
              meta: {
                type: "object",
                additionalProperties: false,
                required: ["request_id"],
                properties: { request_id: { type: "string" } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (APP_REVISION) {
        reply.header("X-MoroccoAPI-Revision", APP_REVISION);
      }
      return {
        data: {
          status: "ok",
          service: "MoroccoAPI",
          version: APP_VERSION,
          timestamp: new Date().toISOString(),
        },
        meta: { request_id: request.id },
      };
    },
  );
};
