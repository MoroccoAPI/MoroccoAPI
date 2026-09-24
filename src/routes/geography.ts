import type { FastifyInstance } from "fastify";

import { buildPendingDatasetMeta } from "../data/geography.js";
import {
  communeSchema,
  errorSchema,
  pendingDatasetMetaSchema,
  provinceSchema,
} from "../schemas.js";
import type { Commune, Province } from "../types.js";

interface ResourceParams {
  code: string;
}

const codeParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code"],
  properties: {
    code: {
      type: "string",
      minLength: 2,
      maxLength: 180,
      pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$",
    },
  },
} as const;

export async function registerGeographyRoutes(
  app: FastifyInstance,
  provinces: readonly Province[],
  communes: readonly Commune[],
): Promise<void> {
  const provinceMetaSchema = pendingDatasetMetaSchema("administrative-provinces");
  const communeMetaSchema = pendingDatasetMetaSchema("administrative-communes");

  app.get(
    "/api/v1/provinces",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "List all provinces and prefectures from the HCP dataset",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: { type: "array", items: provinceSchema },
              meta: provinceMetaSchema,
            },
          },
        },
      },
    },
    async () => ({
      data: provinces,
      meta: buildPendingDatasetMeta("administrative-provinces", provinces.length),
    }),
  );

  app.get<{ Params: ResourceParams }>(
    "/api/v1/provinces/:code",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Get one province or prefecture by MoroccoAPI code",
        params: codeParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: { data: provinceSchema, meta: provinceMetaSchema },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const province = provinces.find(
        (candidate) => candidate.code === request.params.code,
      );
      if (!province) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No province or prefecture found for code '${request.params.code}'`,
            request_id: request.id,
          },
        });
      }

      return {
        data: province,
        meta: buildPendingDatasetMeta("administrative-provinces", 1),
      };
    },
  );

  app.get(
    "/api/v1/communes",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "List all communes from the HCP dataset",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: { type: "array", items: communeSchema },
              meta: communeMetaSchema,
            },
          },
        },
      },
    },
    async () => ({
      data: communes,
      meta: buildPendingDatasetMeta("administrative-communes", communes.length),
    }),
  );

  app.get<{ Params: ResourceParams }>(
    "/api/v1/communes/:code",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Get one commune by MoroccoAPI code",
        params: codeParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: { data: communeSchema, meta: communeMetaSchema },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const commune = communes.find(
        (candidate) => candidate.code === request.params.code,
      );
      if (!commune) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No commune found for code '${request.params.code}'`,
            request_id: request.id,
          },
        });
      }

      return {
        data: commune,
        meta: buildPendingDatasetMeta("administrative-communes", 1),
      };
    },
  );
}
