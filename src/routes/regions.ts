import type { FastifyInstance } from "fastify";

import { buildDatasetMeta } from "../data/regions.js";
import { datasetMetaSchema, errorSchema, regionSchema } from "../schemas.js";
import type { Region } from "../types.js";

interface RegionParams {
  code: string;
}

export async function registerRegionRoutes(
  app: FastifyInstance,
  regions: readonly Region[],
): Promise<void> {
  app.get(
    "/api/v1/regions",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "List Morocco's 12 administrative regions",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: { type: "array", items: regionSchema },
              meta: datasetMetaSchema,
            },
          },
        },
      },
    },
    async () => ({ data: regions, meta: buildDatasetMeta(regions.length) }),
  );

  app.get<{ Params: RegionParams }>(
    "/api/v1/regions/:code",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Get one administrative region by MoroccoAPI code",
        params: {
          type: "object",
          additionalProperties: false,
          required: ["code"],
          properties: {
            code: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-z0-9-]+$" },
          },
        },
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: { data: regionSchema, meta: datasetMetaSchema },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const region = regions.find((candidate) => candidate.code === request.params.code);
      if (!region) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No region found for code '${request.params.code}'`,
            request_id: request.id,
          },
        });
      }

      return { data: region, meta: buildDatasetMeta(1) };
    },
  );

}
