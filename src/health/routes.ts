import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import type { GeographySnapshot } from "../geography/types.js";
import { loadHospitals } from "./data/hospitals.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  datasetMetaSchema,
  hospitalQuerySchema,
  hospitalSchema,
  idParamsSchema,
} from "./schemas.js";
import type { HospitalQuery, ResourceParams } from "./types.js";

export const health: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { regions } = geography;
  const hospitals = await loadHospitals(regions, geography);
  const tags = ["Health"];
  const dataset = "hospitals";
  const metaSchema = datasetMetaSchema(dataset);
  const url = `/api/v1/health/${dataset}`;

  app.get<{ Querystring: HospitalQuery }>(url, {
    schema: {
      tags, summary: "List hospitals with source attribution and optional geographic filters",
      querystring: hospitalQuerySchema(
        regions.map((region) => region.code),
        geography.provinces.map((province) => province.code),
      ),
      response: {
        200: responseSchema({ type: "array", items: hospitalSchema }, metaSchema),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const { region_code, province_code, category, q } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    if (query !== null && query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = hospitals.filter((record) =>
      (region_code === undefined || record.region_code === region_code) &&
      (province_code === undefined || record.province_code === province_code) &&
      (category === undefined || record.category === category) &&
      (query === null || [record.name, ...record.aliases].some((name) => normalizeSearch(name).includes(query))),
    );
    return { data: matches, meta: buildDatasetMeta(dataset, matches.length) };
  });

  app.get<{ Params: ResourceParams }>(`${url}/:id`, {
    schema: {
      tags, summary: "Get a hospital by its stable MoroccoAPI ID",
      params: idParamsSchema(),
      response: {
        200: responseSchema(hospitalSchema, metaSchema),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const record = hospitals.find((item) => item.id === request.params.id);
    if (!record) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND", message: `No hospital found for ID '${request.params.id}'`, request_id: request.id,
      } });
    }
    return { data: record, meta: buildDatasetMeta(dataset, 1) };
  });
};
