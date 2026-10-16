import type { FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import type { GeographySnapshot } from "../geography/types.js";
import { loadMuseums } from "./data.js";
import { buildDatasetMeta } from "./metadata.js";
import { datasetMetaSchema, museumParamsSchema, museumQuerySchema, museumSchema } from "./schemas.js";
import type { MuseumParams, MuseumQuery } from "./types.js";

export const museums: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const records = await loadMuseums(geography);
  const byId = new Map(records.map((row) => [row.id, row]));
  const cities = new Map(geography.communes.map((row) => [row.code, row.name]));
  const tags = ["Museums"];

  app.get<{ Querystring: MuseumQuery & PaginationQuery }>("/api/v1/museums", {
    schema: {
      tags, summary: "List and search the FNM museum inventory",
      description: "23 museums from September 2026. Filters combine with AND. This is FNM coverage, not all Moroccan museums. Hours, tariffs and phone formats are source facts; live opening status is unknown.",
      querystring: paginationQuerySchema(museumQuerySchema([...new Set(records.map((row) => row.city_code))].sort(), geography.regions.map((row) => row.code))),
      response: { 200: collectionResponseSchema(museumSchema, datasetMetaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, city_code, region_code } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    if (query !== null && query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = records.filter((record) => {
      const city = cities.get(record.city_code)!;
      return (city_code === undefined || city_code === record.city_code) &&
        (region_code === undefined || region_code === record.region_code) &&
        (query === null || [...Object.values(record.name), ...record.aliases, ...Object.values(city)]
          .some((name) => name !== null && normalizeSearch(name).includes(query)));
    });
    return paginate(matches, buildDatasetMeta(matches.length), request.query);
  });

  app.get<{ Params: MuseumParams }>("/api/v1/museums/:id", {
    schema: {
      tags, summary: "Get one museum by stable MoroccoAPI ID", params: museumParamsSchema,
      response: { 200: responseSchema(museumSchema, datasetMetaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const record = byId.get(request.params.id);
    if (!record) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: `No museum found for ID '${request.params.id}'`, request_id: request.id,
    } });
    return { data: record, meta: buildDatasetMeta(1) };
  });
};
