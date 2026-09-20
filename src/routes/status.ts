import type { FastifyInstance } from "fastify";

export async function registerStatusRoutes(app: FastifyInstance): Promise<void> {
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
    async (request) => ({
      data: {
        status: "ok",
        service: "MoroccoAPI",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
      },
      meta: { request_id: request.id },
    }),
  );
}
