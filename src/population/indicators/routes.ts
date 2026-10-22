import type { FastifyPluginAsync } from "fastify";

import type { GeographySnapshot } from "../../geography/types.js";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../../common/pagination.js";
import { errorSchema, responseSchema } from "../../common/schemas.js";
import { normalizeSearch } from "../../common/search.js";
import { loadPopulationIndicators } from "./data/indicators.js";
import type { ExistingPopulation } from "./data/transform.js";
import { buildIndicatorDatasetMeta } from "./metadata.js";
import {
  catalogueQuerySchema,
  indicatorDefinitionSchema,
  indicatorMetaSchema,
  indicatorParamsSchema,
  profileParamsSchema,
  profileQuerySchema,
  profileSchema,
  territoryQuerySchema,
  territoryValueSchema,
} from "./schemas.js";
import type { IndicatorLevel, IndicatorProfile, Territory } from "./types.js";

interface TerritoryQuery {
  level?: IndicatorLevel;
  region_code?: string;
  province_code?: string;
}

export const populationIndicators: FastifyPluginAsync<{
  geography: GeographySnapshot;
  existing: ExistingPopulation;
}> = async (app, { geography, existing }) => {
  const { groups, indicators, territories, values } = await loadPopulationIndicators(geography, existing);
  const tags = ["Population"];
  const metaSchema = indicatorMetaSchema();
  const groupIds = groups.map((group) => group.id);
  const census = "Aggregate results of the HCP 2024 General Census of Population and Housing (RGPH 2024), area of residence: all (urban and rural). Rates are rounded to one decimal by HCP.";

  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  const catalogue = indicators.map((indicator) => Object.freeze({
    id: indicator.id, group: indicator.group, group_name: groupNames.get(indicator.group)!,
    unit: indicator.unit, name: indicator.name, source_label: indicator.source_label, sexes: indicator.sexes,
  }));
  const searchable = catalogue.map((entry) => ({
    entry, text: [entry.id, entry.name.fr, entry.name.en, entry.name.ar].map(normalizeSearch),
  }));
  const indicatorIndex = new Map(indicators.map((indicator, index) => [indicator.id, index]));
  const territoryIndex = new Map(territories.map((territory, index) => [`${territory.level}|${territory.code ?? ""}`, index]));
  const regionOf = (territory: Territory) => (territory.level === "regions" ? territory.code : territory.region_code);
  const provinceOf = (territory: Territory) => (territory.level === "subdivisions" ? territory.code : territory.province_code);

  const profile = (index: number, group: string | undefined): IndicatorProfile => ({
    territory: territories[index]!,
    indicators: indicators.flatMap((indicator, position) => group === undefined || indicator.group === group
      ? [{ id: indicator.id, group: indicator.group, unit: indicator.unit, name: indicator.name, ...values[index]![position]! }]
      : []),
  });

  app.get<{ Querystring: { q?: string; group?: string } & PaginationQuery }>("/api/v2/population/indicators", {
    schema: {
      tags, summary: "List the RGPH 2024 socio-economic indicators published by territory",
      description: `The ${catalogue.length} census indicators, filterable by group or text. ${census}`,
      querystring: paginationQuerySchema(catalogueQuerySchema(groupIds)),
      response: { 200: collectionResponseSchema(indicatorDefinitionSchema, metaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { q, group } = request.query;
    const query = q === undefined ? null : normalizeSearch(q);
    if (query !== null && query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = searchable.filter(({ entry, text }) =>
      (group === undefined || entry.group === group) &&
      (query === null || text.some((value) => value.includes(query))),
    ).map(({ entry }) => entry);
    return paginate(matches, buildIndicatorDatasetMeta(matches.length), request.query);
  });

  app.get<{ Params: { id: string }; Querystring: TerritoryQuery & PaginationQuery }>("/api/v2/population/indicators/:id", {
    schema: {
      tags, summary: "List the values of one census indicator across the territories of one level",
      description: `Optional region_code and province_code narrow the list. ${census}`,
      params: indicatorParamsSchema,
      querystring: paginationQuerySchema(territoryQuerySchema),
      response: { 200: collectionResponseSchema(territoryValueSchema, metaSchema), 400: errorSchema, 404: errorSchema },
    },
  }, async (request, reply) => {
    const position = indicatorIndex.get(request.params.id);
    if (position === undefined) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No census indicator found for id '${request.params.id}'`,
        request_id: request.id,
      } });
    }
    const { level = "regions", region_code: regionCode, province_code: provinceCode } = request.query;
    const rows = territories.flatMap((territory, index) =>
      territory.level === level &&
      (regionCode === undefined || regionOf(territory) === regionCode) &&
      (provinceCode === undefined || provinceOf(territory) === provinceCode)
        ? [{ ...territory, ...values[index]![position]! }]
        : []);
    return paginate(rows, buildIndicatorDatasetMeta(rows.length), request.query);
  });

  app.get<{ Querystring: { group?: string } }>("/api/v2/population/national/indicators", {
    schema: {
      tags, summary: "Get every census indicator for Morocco as a whole",
      description: census,
      querystring: profileQuerySchema(groupIds),
      response: { 200: responseSchema(profileSchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => ({
    data: profile(territoryIndex.get("national|")!, request.query.group),
    meta: buildIndicatorDatasetMeta(1),
  }));

  app.get<{ Params: { level: Exclude<IndicatorLevel, "national">; code: string }; Querystring: { group?: string } }>(
    "/api/v2/population/:level/:code/indicators",
    {
      schema: {
        tags, summary: "Get every census indicator for one region, province, prefecture, commune or arrondissement",
        description: `level is one of regions, subdivisions, prefectures-of-arrondissements, communes or arrondissements, and code is the geography code. ${census}`,
        params: profileParamsSchema(),
        querystring: profileQuerySchema(groupIds),
        response: { 200: responseSchema(profileSchema, metaSchema), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const index = territoryIndex.get(`${request.params.level}|${request.params.code}`);
      if (index === undefined) {
        return reply.code(404).send({ error: {
          code: "RESOURCE_NOT_FOUND",
          message: `No census indicators found for ${request.params.level} code '${request.params.code}'`,
          request_id: request.id,
        } });
      }
      return { data: profile(index, request.query.group), meta: buildIndicatorDatasetMeta(1) };
    },
  );
};
