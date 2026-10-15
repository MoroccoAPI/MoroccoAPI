import type { FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadAirports } from "./data.js";
import { buildDatasetMeta } from "./metadata.js";
import { airportParamsSchema, airportQuerySchema, airportSchema, datasetMetaSchema } from "./schemas.js";
import type { AirportParams, AirportQuery } from "./types.js";

export const airports: FastifyPluginAsync = async (app) => {
  const records = await loadAirports();
  const byIcao = new Map(records.filter((row) => row.icao_code !== null).map((row) => [row.icao_code!, row]));
  const tags = ["Airports"];

  app.get<{ Querystring: AirportQuery & PaginationQuery }>("/api/v1/airports", {
    schema: {
      tags, summary: "List and search airports tagged MA in OurAirports",
      description: "Community snapshot from 14 October 2026. Includes heliports and source-marked closed sites. Search names, source municipalities, IATA or ICAO codes. Optional filters combine with AND.",
      querystring: paginationQuerySchema(airportQuerySchema),
      response: { 200: collectionResponseSchema(airportSchema, datasetMetaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, city, type, scheduled_service } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    const municipality = city === undefined ? null : normalizeSearch(city);
    if (query !== null && query.length < 2 || municipality !== null && municipality.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q and city must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = records.filter((record) =>
      (query === null || [record.name, record.municipality, record.iata_code, record.icao_code]
        .some((value) => value !== null && normalizeSearch(value).includes(query))) &&
      (municipality === null || record.municipality !== null && normalizeSearch(record.municipality) === municipality) &&
      (type === undefined || record.type === type) &&
      (scheduled_service === undefined || record.scheduled_service === scheduled_service),
    );
    return paginate(matches, buildDatasetMeta(matches.length), request.query);
  });

  app.get<{ Params: AirportParams }>("/api/v1/airports/:icao", {
    schema: {
      tags, summary: "Get one airport by its explicit ICAO code",
      description: "ICAO lookup is case-insensitive and uses only the source icao_code field. Missing codes are not inferred from ident or GPS identifiers.",
      params: airportParamsSchema,
      response: { 200: responseSchema(airportSchema, datasetMetaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const code = request.params.icao.toUpperCase();
    const record = byIcao.get(code);
    if (!record) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: `No airport found for ICAO '${code}'`, request_id: request.id,
    } });
    return { data: record, meta: buildDatasetMeta(1) };
  });
};
