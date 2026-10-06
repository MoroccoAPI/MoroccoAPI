import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  arrondissementSchema,
  codeParamsSchema,
  communeSchema,
  datasetMetaSchema,
  prefectureOfArrondissementsSchema,
  provinceSchema,
  regionSchema,
} from "./schemas.js";
import type { DatasetMeta, GeographySnapshot, ResourceParams } from "./types.js";

export const geography: FastifyPluginAsync<{ data: GeographySnapshot }> = async (app, { data }) => {
  const { regions, provinces, prefecturesOfArrondissements, communes, arrondissements } = data;
  const tags = ["Administrative geography"];

  const resources = [
    {
      path: "regions", records: regions, schema: regionSchema, label: "region",
      listSummary: "List Morocco's 12 administrative regions",
      detailSummary: "Get one administrative region by MoroccoAPI code",
    },
    {
      path: "provinces", records: provinces, schema: provinceSchema,
      label: "province or prefecture",
      listSummary: "List all provinces and prefectures from the HCP dataset",
      detailSummary: "Get one province or prefecture by MoroccoAPI code",
    },
    {
      path: "prefectures-of-arrondissements", records: prefecturesOfArrondissements,
      schema: prefectureOfArrondissementsSchema, label: "prefecture of arrondissements",
      listSummary: "List Casablanca's eight prefectures of arrondissements",
      detailSummary: "Get one prefecture of arrondissements by MoroccoAPI code",
    },
    {
      path: "communes", records: communes, schema: communeSchema, label: "commune",
      listSummary: "List all communes from the HCP dataset",
      detailSummary: "Get one commune by MoroccoAPI code",
    },
    {
      path: "arrondissements", records: arrondissements, schema: arrondissementSchema,
      label: "arrondissement",
      listSummary: "List the 41 arrondissements of Morocco's six subdivided cities",
      detailSummary: "Get one arrondissement by MoroccoAPI code",
    },
  ] as const;

  for (const resource of resources) {
    const dataset: DatasetMeta["dataset"] = `administrative-${resource.path}`;
    const metaSchema = datasetMetaSchema(dataset);
    const url = `/api/v1/${resource.path}`;

    app.get(url, {
      schema: {
        tags, summary: resource.listSummary,
        response: {
          200: responseSchema({ type: "array", items: resource.schema }, metaSchema),
        },
      },
    }, async () => ({
      data: resource.records,
      meta: buildDatasetMeta(dataset, resource.records.length),
    }));

    app.get<{ Params: ResourceParams }>(`${url}/:code`, {
      schema: {
        tags, summary: resource.detailSummary,
        params: codeParamsSchema(resource.path === "regions"),
        response: { 200: responseSchema(resource.schema, metaSchema), 404: errorSchema },
      },
    }, async (request, reply) => {
      const record = resource.records.find((item) => item.code === request.params.code);
      if (!record) {
        return reply.code(404).send({ error: {
          code: "RESOURCE_NOT_FOUND",
          message: `No ${resource.label} found for code '${request.params.code}'`,
          request_id: request.id,
        } });
      }
      return { data: record, meta: buildDatasetMeta(dataset, 1) };
    });
  }

  app.get<{ Params: ResourceParams }>("/api/v1/regions/:code/subdivisions", {
    schema: {
      tags,
      summary: "Get all subdivisions (provinces and prefectures) by MoroccoAPI region code",
      params: codeParamsSchema(),
      response: {
        200: responseSchema(
          { type: "array", items: provinceSchema },
          datasetMetaSchema("administrative-provinces"),
        ),
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const matches = provinces.filter((item) => item.region_code === request.params.code);
    if (!matches.length) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No provinces or prefectures found for region code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return { data: matches, meta: buildDatasetMeta("administrative-provinces", matches.length) };
  });

  app.get<{ Querystring: { q: string } }>("/api/v1/locations/search", {
    schema: {
      tags,
      summary: "Search administrative regions by code or multilingual name",
      querystring: {
        type: "object", additionalProperties: false, required: ["q"],
        properties: { q: { type: "string", minLength: 2, maxLength: 100 } },
      },
      response: {
        200: responseSchema(
          { type: "array", items: regionSchema },
          datasetMetaSchema("administrative-regions"),
        ),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const query = normalizeSearch(request.query.q);
    if (query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR",
        message: "q must contain at least two non-whitespace characters",
        request_id: request.id,
      } });
    }
    const matches = regions.filter((region) =>
      [region.code, region.name.ar, region.name.fr, region.name.en]
        .some((name) => normalizeSearch(name).includes(query)),
    );
    return { data: matches, meta: buildDatasetMeta("administrative-regions", matches.length) };
  });
};
