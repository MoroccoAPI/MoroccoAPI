import type { FastifyInstance } from "fastify";

import { buildGeographyDatasetMeta } from "../data/geography.js";
import {
  arrondissementSchema,
  communeSchema,
  errorSchema,
  geographyDatasetMetaSchema,
  prefectureOfArrondissementsSchema,
  provinceSchema,
} from "../schemas.js";
import type {
  Arrondissement,
  Commune,
  PrefectureOfArrondissements,
  Province,
} from "../types.js";

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
  prefecturesOfArrondissements: readonly PrefectureOfArrondissements[],
  communes: readonly Commune[],
  arrondissements: readonly Arrondissement[],
): Promise<void> {
  const provinceMetaSchema = geographyDatasetMetaSchema("administrative-provinces");
  const prefectureOfArrondissementsMetaSchema = geographyDatasetMetaSchema(
    "administrative-prefectures-of-arrondissements",
  );
  const communeMetaSchema = geographyDatasetMetaSchema("administrative-communes");
  const arrondissementMetaSchema = geographyDatasetMetaSchema(
    "administrative-arrondissements",
  );

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
      meta: buildGeographyDatasetMeta("administrative-provinces", provinces.length),
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
        meta: buildGeographyDatasetMeta("administrative-provinces", 1),
      };
    },
  );

  app.get(
    "/api/v1/prefectures-of-arrondissements",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "List Casablanca's eight prefectures of arrondissements",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: {
                type: "array",
                items: prefectureOfArrondissementsSchema,
              },
              meta: prefectureOfArrondissementsMetaSchema,
            },
          },
        },
      },
    },
    async () => ({
      data: prefecturesOfArrondissements,
      meta: buildGeographyDatasetMeta(
        "administrative-prefectures-of-arrondissements",
        prefecturesOfArrondissements.length,
      ),
    }),
  );

  app.get<{ Params: ResourceParams }>(
    "/api/v1/prefectures-of-arrondissements/:code",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Get one prefecture of arrondissements by MoroccoAPI code",
        params: codeParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: prefectureOfArrondissementsSchema,
              meta: prefectureOfArrondissementsMetaSchema,
            },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const prefecture = prefecturesOfArrondissements.find(
        (candidate) => candidate.code === request.params.code,
      );
      if (!prefecture) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No prefecture of arrondissements found for code '${request.params.code}'`,
            request_id: request.id,
          },
        });
      }

      return {
        data: prefecture,
        meta: buildGeographyDatasetMeta(
          "administrative-prefectures-of-arrondissements",
          1,
        ),
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
      meta: buildGeographyDatasetMeta("administrative-communes", communes.length),
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
        meta: buildGeographyDatasetMeta("administrative-communes", 1),
      };
    },
  );

  app.get(
    "/api/v1/arrondissements",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "List the 41 arrondissements of Morocco's six subdivided cities",
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: { type: "array", items: arrondissementSchema },
              meta: arrondissementMetaSchema,
            },
          },
        },
      },
    },
    async () => ({
      data: arrondissements,
      meta: buildGeographyDatasetMeta(
        "administrative-arrondissements",
        arrondissements.length,
      ),
    }),
  );

  app.get<{ Params: ResourceParams }>(
    "/api/v1/arrondissements/:code",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Get one arrondissement by MoroccoAPI code",
        params: codeParamsSchema,
        response: {
          200: {
            type: "object",
            additionalProperties: false,
            required: ["data", "meta"],
            properties: {
              data: arrondissementSchema,
              meta: arrondissementMetaSchema,
            },
          },
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const arrondissement = arrondissements.find(
        (candidate) => candidate.code === request.params.code,
      );
      if (!arrondissement) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No arrondissement found for code '${request.params.code}'`,
            request_id: request.id,
          },
        });
      }

      return {
        data: arrondissement,
        meta: buildGeographyDatasetMeta("administrative-arrondissements", 1),
      };
    },
  );
}
