import type { FastifyPluginAsync } from "fastify";

import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadInsuranceIntermediaries } from "./data.js";
import { buildDatasetMeta } from "./metadata.js";
import { insuranceMetaSchema, intermediaryParamsSchema, intermediaryQuerySchema, intermediarySchema } from "./schemas.js";
import type { InsuranceIntermediary, IntermediaryQuery } from "./types.js";

export const insurance: FastifyPluginAsync = async (app) => {
  const { intermediaries, manifest } = await loadInsuranceIntermediaries();
  const byCode = new Map<string, InsuranceIntermediary[]>();
  for (const entry of intermediaries) {
    const matches = byCode.get(entry.acaps_code);
    if (matches) matches.push(entry);
    else byCode.set(entry.acaps_code, [entry]);
  }
  const tags = ["Insurance"];

  app.get<{ Querystring: IntermediaryQuery & PaginationQuery }>("/api/v2/insurance/intermediaries", {
    schema: {
      tags, summary: "Search the ACAPS insurance intermediary directory snapshot",
      description: "Agents, brokers and direct management offices from acaps.ma. Filters combine with AND. This dated snapshot does not confirm current authorization. Redistribution permission has not been obtained.",
      querystring: paginationQuerySchema(intermediaryQuerySchema),
      response: { 200: collectionResponseSchema(intermediarySchema, insuranceMetaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, city, category } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    const locality = city === undefined ? null : normalizeSearch(city);
    if ((query !== null && query.length < 2) || (locality !== null && locality.length < 2)) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q and city must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = intermediaries.filter((entry) =>
      (query === null || [entry.acaps_code, entry.name, entry.insurer]
        .some((value) => value !== null && normalizeSearch(value).includes(query))) &&
      (locality === null || entry.city !== null && normalizeSearch(entry.city).includes(locality)) &&
      (category === undefined || entry.category === category),
    );
    return paginate(matches, buildDatasetMeta(matches.length, manifest), request.query);
  });

  app.get<{ Params: { code: string }; Querystring: PaginationQuery }>("/api/v2/insurance/intermediaries/:code", {
    schema: {
      tags, summary: "Get insurance intermediary records by ACAPS code",
      description: "Case-insensitive lookup returning all source records for a code, including conflicting entries. A missing record does not establish that an intermediary is unauthorized.",
      params: intermediaryParamsSchema,
      querystring: paginationQuerySchema(),
      response: { 200: collectionResponseSchema(intermediarySchema, insuranceMetaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const data = byCode.get(request.params.code.toUpperCase());
    const result = paginate(data ?? [], buildDatasetMeta(data?.length ?? 0, manifest), request.query);
    if (!data) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: "Intermediary not found in the ACAPS snapshot", request_id: request.id,
    } });
    return result;
  });
};
