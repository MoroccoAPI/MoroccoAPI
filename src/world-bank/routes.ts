import type { FastifyPluginAsync } from "fastify";

import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { assertSafeIntegerInRange } from "../common/validation.js";
import { loadWorldBank } from "./data/indicators.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  datasetMetaSchema,
  indicatorParamsSchema,
  indicatorQuerySchema,
  indicatorSchema,
  indicatorSummarySchema,
  topicSchema,
  valueRangeQuerySchema,
} from "./schemas.js";
import type { IndicatorParams, IndicatorQuery, IndicatorSummary, ValueRangeQuery } from "./types.js";

export const worldBank: FastifyPluginAsync = async (app) => {
  const { indicators, topics, excluded } = await loadWorldBank();
  const tags = ["World Bank"];
  const metaSchema = datasetMetaSchema();
  const estimates = "World Bank compilations and estimates, often from third parties; they can differ from Moroccan official statistics (for example HCP census population) and are revised in later releases.";

  // The catalogue omits attribution detail and values; GET /indicators/{code} carries them.
  const summaries: readonly IndicatorSummary[] = indicators.map((indicator) => Object.freeze({
    code: indicator.code, name: indicator.name, topic_code: indicator.topic_code, topic: indicator.topic,
    unit: indicator.unit, periodicity: indicator.periodicity, license: indicator.license,
    first_year: indicator.first_year, last_year: indicator.last_year, value_count: indicator.value_count,
  }));
  const searchable = summaries.map((summary) => ({ summary, text: [summary.code, summary.name].map(normalizeSearch) }));
  // Codes are unique ignoring case (checked at load), so lookups accept any case.
  const byCode = new Map(indicators.map((indicator) => [indicator.code.toUpperCase(), indicator]));
  const excludedByCode = new Map(excluded.map((entry) => [entry.code.toUpperCase(), entry]));

  app.get<{ Querystring: IndicatorQuery & PaginationQuery }>("/api/v1/world-bank/indicators", {
    schema: {
      tags, summary: "List World Bank development indicators available for Morocco",
      description: `The ${summaries.length} World Development Indicators with Moroccan values and a CC BY 4.0 license. ${estimates}`,
      querystring: paginationQuerySchema(indicatorQuerySchema(topics.map((topic) => topic.code))),
      response: { 200: collectionResponseSchema(indicatorSummarySchema, metaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, topic } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    if (query !== null && query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = searchable.filter(({ summary, text }) =>
      (topic === undefined || summary.topic_code === topic) &&
      (query === null || text.some((value) => value.includes(query))),
    ).map(({ summary }) => summary);
    return paginate(matches, buildDatasetMeta(matches.length), request.query);
  });

  app.get<{ Querystring: PaginationQuery }>("/api/v1/world-bank/indicators/topics", {
    schema: {
      tags, summary: "List the World Bank topic groups with their number of indicators",
      querystring: paginationQuerySchema(),
      response: { 200: collectionResponseSchema(topicSchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => paginate(topics, buildDatasetMeta(topics.length), request.query));

  app.get<{ Params: IndicatorParams; Querystring: ValueRangeQuery }>("/api/v1/world-bank/indicators/:code", {
    schema: {
      tags, summary: "Get one World Bank indicator for Morocco with its annual values",
      description: `Optional from/to select an inclusive range of years. ${estimates}`,
      params: indicatorParamsSchema,
      querystring: valueRangeQuerySchema,
      response: { 200: responseSchema(indicatorSchema, metaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const { from, to } = request.query;
    if (from !== undefined) assertSafeIntegerInRange(from, "from", 1960, 2100);
    if (to !== undefined) assertSafeIntegerInRange(to, "to", 1960, 2100);
    if (from !== undefined && to !== undefined && from > to) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "from must not be after to", request_id: request.id,
      } });
    }
    const key = request.params.code.toUpperCase();
    const indicator = byCode.get(key);
    if (!indicator) {
      const exclusion = excludedByCode.get(key);
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: exclusion
          ? `Indicator '${exclusion.code}' is not published: its license (${exclusion.license_type}) is not CC BY 4.0`
          : `No World Bank indicator with Moroccan data found for code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    const values = indicator.values.filter((value) =>
      (from === undefined || value.year >= from) && (to === undefined || value.year <= to));
    return { data: { ...indicator, values }, meta: buildDatasetMeta(1) };
  });
};
