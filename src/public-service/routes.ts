import type { FastifyPluginAsync } from "fastify";

import { normalizeSearch } from "../common/search.js";
import { loadGradeSalaries } from "./data/salaries.js";
import { buildDatasetMeta } from "./metadata.js";
import { datasetMetaSchema, errorSchema, gradeSalarySchema, responseSchema } from "./schemas.js";

interface SalaryQuery {
  q?: string;
  corps?: string;
  min_salary?: number;
  max_salary?: number;
}

export const publicService: FastifyPluginAsync = async (app) => {
  const salaries = await loadGradeSalaries();
  const searchIndex = salaries.map((record) => ({
    record,
    text: normalizeSearch(`${record.grade.fr} ${record.corps.ar} ${record.code}`),
    corps: normalizeSearch(record.corps.ar),
  }));

  app.get<{ Querystring: SalaryQuery }>("/api/v1/public-service/salaries", {
    schema: {
      tags: ["Public service"],
      summary: "List simulated reference net monthly salaries by civil-service grade",
      description:
        "Secondary dataset compiled by Wadifa Info from the official salary simulator " +
        "(simulation.mmsp.gov.ma). Values are simulated references, not official salary entitlements; " +
        "see meta.notice for the simulation settings.",
      querystring: {
        type: "object",
        additionalProperties: false,
        properties: {
          q: { type: "string", minLength: 2, maxLength: 120, description: "Search grade or corps names (accent-insensitive)" },
          corps: { type: "string", minLength: 2, maxLength: 120, description: "Exact corps name in Arabic" },
          min_salary: { type: "integer", minimum: 0, description: "Minimum net monthly salary in MAD" },
          max_salary: { type: "integer", minimum: 0, description: "Maximum net monthly salary in MAD" },
        },
      },
      response: {
        200: responseSchema({ type: "array", items: gradeSalarySchema }, datasetMetaSchema()),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const { q, corps, min_salary: min, max_salary: max } = request.query;
    if (min !== undefined && max !== undefined && min > max) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR",
        message: "min_salary must be less than or equal to max_salary",
        request_id: request.id,
      } });
    }
    const query = q === undefined ? undefined : normalizeSearch(q);
    const corpsQuery = corps === undefined ? undefined : normalizeSearch(corps);
    const data = searchIndex
      .filter((item) =>
        (query === undefined || item.text.includes(query)) &&
        (corpsQuery === undefined || item.corps === corpsQuery) &&
        (min === undefined || item.record.net_monthly_salary_mad >= min) &&
        (max === undefined || item.record.net_monthly_salary_mad <= max))
      .map((item) => item.record);
    return { data, meta: buildDatasetMeta(data.length) };
  });

  app.get<{ Params: { code: string } }>("/api/v1/public-service/salaries/:code", {
    schema: {
      tags: ["Public service"],
      summary: "Get the simulated reference net monthly salary of one civil-service grade",
      params: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: { type: "string", minLength: 2, maxLength: 160, pattern: "^[a-z0-9-]+$" },
        },
      },
      response: {
        200: responseSchema(gradeSalarySchema, datasetMetaSchema()),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const record = salaries.find((item) => item.code === request.params.code);
    if (!record) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No public-service salary found for code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return { data: record, meta: buildDatasetMeta(1) };
  });
};
