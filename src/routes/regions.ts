import type { FastifyInstance } from "fastify";

import { buildDatasetMeta } from "../data/regions.js";
import { datasetMetaSchema, errorSchema, regionSchema } from "../schemas.js";
import type { Region } from "../types.js";

interface RegionParams {
  code: string;
}

interface SearchQuery {
  q: string;
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase("fr")
    .trim();
}

function matchesRegion(region: Region, query: string): boolean {
  const haystack = [region.code, region.name.ar, region.name.fr, region.name.en];
  return haystack.some((value) => normalizeSearchValue(value).includes(query));
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

  app.get<{ Querystring: SearchQuery }>(
    "/api/v1/locations/search",
    {
      schema: {
        tags: ["Administrative geography"],
        summary: "Search administrative regions by code or multilingual name",
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["q"],
          properties: { q: { type: "string", minLength: 2, maxLength: 100 } },
        },
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
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const normalizedQuery = normalizeSearchValue(request.query.q);
      if (normalizedQuery.length < 2) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "q must contain at least two non-whitespace characters",
            request_id: request.id,
          },
        });
      }

      const matches = regions.filter((region) => matchesRegion(region, normalizedQuery));
      return { data: matches, meta: buildDatasetMeta(matches.length) };
    },
  );
}
