import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import type { GeographySnapshot } from "../geography/types.js";
import { loadPostal } from "./data/postal-codes.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  datasetMetaSchema,
  multiCodeCitySchema,
  postalCodeParamsSchema,
  postalCodeQuerySchema,
  postalCodeSchema,
} from "./schemas.js";
import type { PostalCodeParams, PostalCodeQuery } from "./types.js";

/** City filters ignore spacing and hyphens, so "El Jadida" matches the source spelling "ELJADIDA". */
function compact(value: string): string {
  return normalizeSearch(value).replace(/[^\p{L}\p{N}]+/gu, "");
}

export const postal: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { postalCodes, cities } = await loadPostal(geography);
  const tags = ["Postal codes"];
  const snapshot = "Source: Poste Maroc open data, last updated September 2018; codes created or changed since then are missing.";
  const metaSchema = datasetMetaSchema();
  const searchable = postalCodes.map((record) => ({
    record,
    names: [record.name, record.city ?? ""].map(normalizeSearch),
    city: record.city === null ? null : compact(record.city),
  }));
  const cityByKey = new Map(cities.map((city) => [compact(city.name), city.name]));

  app.get<{ Querystring: PostalCodeQuery }>("/api/v1/postal-codes", {
    schema: {
      tags, summary: "Search postal codes by place, city, province or region",
      description: `Requires at least one of q, region_code, province_code or city. A place can have several codes, and one code can cover many places. ${snapshot}`,
      querystring: postalCodeQuerySchema(
        geography.regions.map((region) => region.code),
        geography.provinces.map((province) => province.code),
      ),
      response: {
        200: responseSchema({ type: "array", items: postalCodeSchema }, metaSchema),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const { q, type, region_code, province_code, city } = request.query;
    if (q === undefined && region_code === undefined && province_code === undefined && city === undefined) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR",
        message: "Provide at least one of q, region_code, province_code or city",
        request_id: request.id,
      } });
    }
    const query = q === undefined ? null : normalizeSearch(q);
    if (query !== null && query.length < 2) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const cityKey = city === undefined ? null : compact(city);
    if (cityKey !== null && !cityByKey.has(cityKey)) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR",
        message: "city must be one of the multi-code cities listed at /api/v1/postal-codes/cities",
        request_id: request.id,
      } });
    }
    const isCodePrefix = query !== null && /^\d+$/.test(query);
    const matches = searchable.filter(({ record, names, city: recordCity }) =>
      (type === undefined || record.type === type) &&
      (region_code === undefined || record.region_code === region_code) &&
      (province_code === undefined || record.province_code === province_code) &&
      (cityKey === null || recordCity === cityKey) &&
      (query === null || (isCodePrefix ? record.postal_code.startsWith(query) : names.some((name) => name.includes(query)))),
    ).map(({ record }) => record);
    return { data: matches, meta: buildDatasetMeta(matches.length) };
  });

  app.get("/api/v1/postal-codes/cities", {
    schema: {
      tags, summary: "List the cities whose neighbourhoods have different postal codes", description: snapshot,
      response: { 200: responseSchema({ type: "array", items: multiCodeCitySchema }, metaSchema) },
    },
  }, async () => ({ data: cities, meta: buildDatasetMeta(cities.length) }));

  app.get<{ Params: PostalCodeParams }>("/api/v1/postal-codes/:code", {
    schema: {
      tags, summary: "Get every locality and neighbourhood that uses a postal code", description: snapshot,
      params: postalCodeParamsSchema,
      response: {
        200: responseSchema({ type: "array", items: postalCodeSchema }, metaSchema),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const matches = postalCodes.filter((record) => record.postal_code === request.params.code);
    if (!matches.length) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No place found for postal code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return { data: matches, meta: buildDatasetMeta(matches.length) };
  });
};
