import type { FastifyPluginAsync } from "fastify";

import type { GeographySnapshot } from "../../geography/types.js";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../../common/pagination.js";
import { errorSchema, responseSchema } from "../../common/schemas.js";
import { profileParamsSchema } from "../indicators/schemas.js";
import type { IndicatorLevel } from "../indicators/types.js";
import { loadPovertyData } from "./data/poverty.js";
import { buildPovertyDatasetMeta } from "./metadata.js";
import {
  povertyMetaSchema,
  povertyProfileQuerySchema,
  povertyProfileSchema,
  povertyQuerySchema,
  territoryObservationSchema,
} from "./schemas.js";
import type { PovertyArea, PovertyProfile, PovertyTerritory, PovertyYear } from "./types.js";

interface PovertyQuery {
  level?: IndicatorLevel;
  area?: PovertyArea;
  year?: PovertyYear;
  region_code?: string;
  province_code?: string;
}

interface ProfileQuery {
  area?: PovertyArea;
  year?: PovertyYear;
}

export const populationPoverty: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { territories, observations } = await loadPovertyData(geography);
  const tags = ["Population"];
  const metaSchema = povertyMetaSchema();
  const source = "HCP multidimensional poverty mapping (May 2025) from the 2024 and 2014 censuses, with 2014 revised for comparison. HCP's MPI method differs from World Bank poverty lines; do not treat the figures as interchangeable.";

  const territoryIndex = new Map(territories.map((territory, index) => [`${territory.level}|${territory.code ?? ""}`, index]));
  const regionOf = (territory: PovertyTerritory) => (territory.level === "regions" ? territory.code : territory.region_code);
  const provinceOf = (territory: PovertyTerritory) => (territory.level === "subdivisions" ? territory.code : territory.province_code);

  const profile = (index: number, { area, year }: ProfileQuery): PovertyProfile => ({
    territory: territories[index]!,
    observations: observations[index]!.filter((observation) =>
      (area === undefined || observation.area === area) && (year === undefined || observation.year === year)),
  });

  app.get<{ Querystring: PovertyQuery & PaginationQuery }>("/api/v2/population/poverty", {
    schema: {
      tags, summary: "List multidimensional poverty for the territories of one level, area and census year",
      description: `Optional region_code and province_code narrow the list. ${source}`,
      querystring: paginationQuerySchema(povertyQuerySchema),
      response: { 200: collectionResponseSchema(territoryObservationSchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => {
    const { level = "regions", area = "all", year = 2024, region_code: regionCode, province_code: provinceCode } = request.query;
    const rows = territories.flatMap((territory, index) => {
      if (territory.level !== level ||
        (regionCode !== undefined && regionOf(territory) !== regionCode) ||
        (provinceCode !== undefined && provinceOf(territory) !== provinceCode)) return [];
      const observation = observations[index]!.find((item) => item.area === area && item.year === year);
      return observation ? [{ ...territory, ...observation }] : [];
    });
    return paginate(rows, buildPovertyDatasetMeta(rows.length), request.query);
  });

  app.get<{ Querystring: ProfileQuery }>("/api/v2/population/national/poverty", {
    schema: {
      tags, summary: "Get multidimensional poverty for Morocco as a whole",
      description: source,
      querystring: povertyProfileQuerySchema,
      response: { 200: responseSchema(povertyProfileSchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => ({
    data: profile(territoryIndex.get("national|")!, request.query),
    meta: buildPovertyDatasetMeta(1),
  }));

  app.get<{ Params: { level: Exclude<IndicatorLevel, "national">; code: string }; Querystring: ProfileQuery }>(
    "/api/v2/population/:level/:code/poverty",
    {
      schema: {
        tags, summary: "Get multidimensional poverty for one region, province, prefecture, commune or arrondissement",
        description: `level is one of regions, subdivisions, prefectures-of-arrondissements, communes or arrondissements, and code is the geography code. ${source}`,
        params: profileParamsSchema(),
        querystring: povertyProfileQuerySchema,
        response: { 200: responseSchema(povertyProfileSchema, metaSchema), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const index = territoryIndex.get(`${request.params.level}|${request.params.code}`);
      if (index === undefined) {
        return reply.code(404).send({ error: {
          code: "RESOURCE_NOT_FOUND",
          message: `No poverty data found for ${request.params.level} code '${request.params.code}'`,
          request_id: request.id,
        } });
      }
      return { data: profile(index, request.query), meta: buildPovertyDatasetMeta(1) };
    },
  );
};
