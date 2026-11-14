import type { FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadRailDataset } from "./data/stations.js";
import { buildDatasetMeta } from "./metadata.js";
import { stationMetaSchema, stationParamsSchema, stationQuerySchema, stationSchema } from "./schemas.js";
import type { Station, StationParams, StationQuery } from "./types.js";

export const rail: FastifyPluginAsync = async (app) => {
  const { records, manifest } = await loadRailDataset();
  const metaSchema = stationMetaSchema(manifest);
  const byId = new Map<string, Station>();
  // Reviewed secondary OSM identifiers remain usable after a merge.
  for (const record of records) for (const source of record.sources) {
    byId.set(`osm-${source.osm_type}-${source.osm_id}`, record);
  }
  const tags = ["Railway stations"];
  app.get<{ Querystring: StationQuery & PaginationQuery }>("/api/v2/transport/rail/stations", {
    schema: {
      tags, summary: "List and search mapped railway stations and halts",
      description: "Dated OpenStreetMap snapshot from Geofabrik. Includes explicitly mapped inactive and planned sites; current passenger service and connections are unknown. Filters combine with AND. Results are sorted by persistent OSM identifier.",
      querystring: paginationQuerySchema(stationQuerySchema),
      response: { 200: collectionResponseSchema(stationSchema, metaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, city, type, status } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    const cityName = city === undefined ? null : normalizeSearch(city);
    if (query !== null && query.length < 2 || cityName !== null && cityName.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q and city must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = records.filter((record) =>
      (query === null || [record.name, ...Object.values(record.names), ...record.aliases, record.city, record.id, record.wikidata_id]
        .some((value) => value !== null && normalizeSearch(value).includes(query))) &&
      (cityName === null || record.city !== null && normalizeSearch(record.city) === cityName) &&
      (type === undefined || record.type === type) && (status === undefined || record.osm_status === status));
    return paginate(matches, buildDatasetMeta(manifest, matches.length), request.query);
  });

  app.get<{ Params: StationParams }>("/api/v2/transport/rail/stations/:id", {
    schema: {
      tags, summary: "Get a mapped railway station by OSM identifier",
      description: "Use an id returned by the list. A reviewed secondary OSM identifier resolves to its canonical station. These are not official ONCF or UIC codes.",
      params: stationParamsSchema,
      response: { 200: responseSchema(stationSchema, metaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const record = byId.get(request.params.id);
    if (!record) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: `No railway station found for '${request.params.id}'`, request_id: request.id,
    } });
    return { data: record, meta: buildDatasetMeta(manifest, 1) };
  });
};
