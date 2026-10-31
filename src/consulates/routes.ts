import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { loadConsulates } from "./data.js";
import { buildDatasetMeta } from "./metadata.js";
import { consulateMetaSchema, consulateParamsSchema, consulateQuerySchema, consulateSchema } from "./schemas.js";

export const consulates: FastifyPluginAsync = async (app) => {
  const snapshot = await loadConsulates();
  const { manifest } = snapshot;
  const byId = new Map(snapshot.consulates.map((entry) => [entry.id, entry]));

  app.get<{ Querystring: { country?: string } & PaginationQuery }>("/api/v2/consulates", {
    schema: {
      tags: ["Consulates"],
      summary: "List Moroccan consulates in the local directory snapshot",
      description: "Institutional contacts from diplomatie.ma. Source reuse permission has not been obtained; coverage and freshness are unverified.",
      querystring: paginationQuerySchema(consulateQuerySchema),
      response: {
        200: collectionResponseSchema(consulateSchema, consulateMetaSchema),
        400: errorSchema,
      },
    },
  }, async (request) => {
    const country = request.query.country?.toUpperCase();
    const data = country ? snapshot.consulates.filter((entry) => entry.country.code === country) : snapshot.consulates;
    return paginate(data, buildDatasetMeta(data.length, manifest), request.query);
  });

  app.get<{ Params: { id: string } }>("/api/v2/consulates/:id", {
    schema: {
      tags: ["Consulates"], summary: "Get a Moroccan consulate by its stable ID",
      params: consulateParamsSchema,
      response: {
        200: responseSchema(consulateSchema, consulateMetaSchema),
        400: errorSchema, 404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const data = byId.get(request.params.id);
    if (!data) return reply.code(404).send({
      error: { code: "RESOURCE_NOT_FOUND", message: "Consulate not found", request_id: request.id },
    });
    return { data, meta: buildDatasetMeta(1, manifest) };
  });
};
