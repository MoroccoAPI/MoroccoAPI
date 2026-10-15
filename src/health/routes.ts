import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { collectionResponseSchema, paginate, paginationQuerySchema } from "../common/pagination.js";
import type { PaginationQuery } from "../common/pagination.js";
import type { GeographySnapshot } from "../geography/types.js";
import { loadHospitals } from "./data/hospitals.js";
import { loadPrimaryCareFacilities } from "./data/primary-care-facilities.js";
import { loadPrivateInfrastructure } from "./data/private-infrastructure.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  datasetMetaSchema,
  hospitalQuerySchema,
  hospitalSchema,
  idParamsSchema,
  primaryCareFacilitySchema,
  primaryCareQuerySchema,
  privateInfrastructureQuerySchema,
  privateInfrastructureSchema,
} from "./schemas.js";
import type { HospitalQuery, PrimaryCareQuery, PrivateInfrastructureQuery, ResourceParams } from "./types.js";

export const health: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { regions } = geography;
  const hospitals = await loadHospitals(regions, geography);
  const primaryCareFacilities = await loadPrimaryCareFacilities(regions, geography);
  const privateInfrastructure = await loadPrivateInfrastructure(regions);
  const tags = ["Health"];
  const dataset = "hospitals";
  const metaSchema = datasetMetaSchema(dataset);
  const url = `/api/v1/health/${dataset}`;

  app.get<{ Querystring: PrivateInfrastructureQuery & PaginationQuery }>("/api/v1/health/private-infrastructure", {
    schema: {
      tags, summary: "Get national and regional private health infrastructure counts",
      description: "Counts describe 2024, including regional figures published by HCP in its 2026 edition. Without a region filter, returns one national aggregate and twelve regional records. Missing regional indicators are null; national and regional counts must not be added together.",
      querystring: paginationQuerySchema(privateInfrastructureQuerySchema(regions.map((region) => region.code))),
      response: {
        200: collectionResponseSchema(privateInfrastructureSchema, datasetMetaSchema("private-infrastructure")),
        400: errorSchema,
      },
    },
  }, async (request) => {
    const { region_code } = request.query;
    const matches = privateInfrastructure.filter((record) => region_code === undefined || record.region_code === region_code);
    return paginate(matches, buildDatasetMeta("private-infrastructure", matches.length), request.query);
  });

  app.get<{ Querystring: PrimaryCareQuery & PaginationQuery }>("/api/v1/health/primary-care-facilities", {
    schema: {
      tags, summary: "List public primary-care facilities with optional geographic filters",
      description: "National registry for 2024 with partial commissioning confirmations from 2026. This is not a complete national registry for 2026.",
      querystring: paginationQuerySchema(primaryCareQuerySchema(
        regions.map((region) => region.code),
        geography.provinces.map((province) => province.code),
      )),
      response: {
        200: collectionResponseSchema(primaryCareFacilitySchema, datasetMetaSchema("primary-care-facilities")),
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
    const matches = primaryCareFacilities.filter((record) =>
      (region_code === undefined || record.region_code === region_code) &&
      (province_code === undefined || record.province_code === province_code) &&
      (category === undefined || record.category === category) &&
      (query === null || [record.name, ...record.aliases].some((name) => normalizeSearch(name).includes(query))),
    );
    return paginate(matches, buildDatasetMeta("primary-care-facilities", matches.length), request.query);
  });

  app.get<{ Querystring: HospitalQuery & PaginationQuery }>(url, {
    schema: {
      tags, summary: "List hospitals with source attribution and optional geographic filters",
      querystring: paginationQuerySchema(hospitalQuerySchema(
        regions.map((region) => region.code),
        geography.provinces.map((province) => province.code),
      )),
      response: {
        200: collectionResponseSchema(hospitalSchema, metaSchema),
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
    return paginate(matches, buildDatasetMeta(dataset, matches.length), request.query);
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
