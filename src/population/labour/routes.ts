import type { FastifyPluginAsync } from "fastify";

import type { GeographySnapshot } from "../../geography/types.js";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../../common/pagination.js";
import { errorSchema } from "../../common/schemas.js";
import { loadLabourData } from "./data/labour.js";
import { buildLabourDatasetMeta } from "./metadata.js";
import { labourMetaSchema, labourObservationSchema, labourQuerySchema } from "./schemas.js";
import type { LabourArea } from "./types.js";

interface LabourQuery {
  province_code?: string;
  region_code?: string;
  area?: LabourArea;
  year?: number;
  from?: number;
  to?: number;
}

export const populationLabour: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { years, observations } = await loadLabourData(geography);
  const source = `HCP National Employment Survey (Enquête nationale sur l'emploi), yearly rates ${years[0]}–${years.at(-1)}, from data.gov.ma. These survey estimates differ from the RGPH 2024 census rates in /api/v2/population/indicators; do not mix the two sources.`;

  app.get<{ Querystring: LabourQuery & PaginationQuery }>("/api/v2/population/labour", {
    schema: {
      tags: ["Population"],
      summary: "List labour market rates by province or prefecture, area and year",
      description: `One record per province or prefecture, area and year, sorted by province code, then area, then year (oldest first). Optional province_code, region_code, year and from/to narrow the list. ${source}`,
      querystring: paginationQuerySchema(labourQuerySchema),
      response: { 200: collectionResponseSchema(labourObservationSchema, labourMetaSchema()), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { province_code: provinceCode, region_code: regionCode, area = "all", year, from, to } = request.query;
    if (from !== undefined && to !== undefined && from > to) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "from must not be after to", request_id: request.id,
      } });
    }
    const rows = observations.filter((observation) =>
      observation.area === area &&
      (provinceCode === undefined || observation.code === provinceCode) &&
      (regionCode === undefined || observation.region_code === regionCode) &&
      (year === undefined || observation.year === year) &&
      (from === undefined || observation.year >= from) &&
      (to === undefined || observation.year <= to));
    return paginate(rows, buildLabourDatasetMeta(rows.length), request.query);
  });
};
