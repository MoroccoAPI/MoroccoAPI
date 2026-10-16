import type { FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadLighthouses, loadPorts } from "./data.js";
import { buildMaritimeMeta } from "./metadata.js";
import { lighthouseQuerySchema, lighthouseSchema, maritimeMetaSchema, portParamsSchema, portSchema } from "./schemas.js";
import type { LighthouseQuery, PortParams } from "./types.js";

export const maritime: FastifyPluginAsync = async (app) => {
  const ports = await loadPorts();
  const lighthouses = await loadLighthouses();
  const portsByName = new Map(ports.map((port) => [normalizeSearch(port["Nom du port"]), port]));

  app.get<{ Querystring: PaginationQuery }>("/api/v1/ports", {
    schema: {
      tags: ["Maritime"], summary: "List Moroccan ports",
      description: "Ports from the Ministry of Equipment and Water source list. Source fields are preserved in French.",
      querystring: paginationQuerySchema(),
      response: { 200: collectionResponseSchema(portSchema, maritimeMetaSchema), 400: errorSchema },
    },
  }, async (request) => paginate(ports, buildMaritimeMeta("ports", ports.length), request.query));

  app.get<{ Params: PortParams }>("/api/v1/ports/:name", {
    schema: {
      tags: ["Maritime"], summary: "Get a Moroccan port by name",
      description: "Matches the source port name case- and accent-insensitively.",
      params: portParamsSchema,
      response: {
        200: responseSchema(portSchema, maritimeMetaSchema),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const name = normalizeSearch(request.params.name);
    if (name.length < 2) return reply.code(400).send({ error: {
      code: "VALIDATION_ERROR", message: "name must contain at least two non-whitespace characters", request_id: request.id,
    } });
    const port = portsByName.get(name);
    if (!port) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: `No port found for name '${request.params.name}'`, request_id: request.id,
    } });
    return { data: port, meta: buildMaritimeMeta("ports", 1) };
  });

  app.get<{ Querystring: LighthouseQuery & PaginationQuery }>("/api/v1/lighthouses", {
    schema: {
      tags: ["Maritime"], summary: "List Moroccan lighthouses (phares)",
      description: "Lighthouses from the Ministry of Equipment and Water source list. Source fields are preserved in French. Optional filters combine with AND.",
      querystring: paginationQuerySchema(lighthouseQuerySchema),
      response: { 200: collectionResponseSchema(lighthouseSchema, maritimeMetaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { name, region, province, type, ville } = request.query;
    const filters = [name, region, province, type, ville].filter((value): value is string => value !== undefined);
    if (filters.some((value) => normalizeSearch(value).length < 2)) return reply.code(400).send({ error: {
      code: "VALIDATION_ERROR", message: "Text filters must contain at least two non-whitespace characters", request_id: request.id,
    } });
    const matches = lighthouses.filter((row) =>
      (name === undefined || normalizeSearch(row.Nom).includes(normalizeSearch(name))) &&
      (region === undefined || normalizeSearch(row.Region).includes(normalizeSearch(region))) &&
      (province === undefined || normalizeSearch(row.Province).includes(normalizeSearch(province))) &&
      (type === undefined || normalizeSearch(row["Type du phare"]).includes(normalizeSearch(type))) &&
      (ville === undefined || normalizeSearch(row.Ville).includes(normalizeSearch(ville))),
    );
    return paginate(matches, buildMaritimeMeta("lighthouses", matches.length), request.query);
  });
};
