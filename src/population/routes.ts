import type { FastifyPluginAsync } from "fastify";

import { loadRegionPopulation } from "./data/regions.js";
import { loadCommunePopulation } from "./data/communes.js";
import { loadSubdivisionPopulation } from "./data/subdivisions.js";
import { loadNationalPopulation } from "./data/population.js";
import { loadHistoricalPopulation } from "./data/historical.js";
import { buildDatasetMeta } from "./metadata.js";
import {
  datasetMetaSchema,
  errorSchema,
  nationalPopulationSchema,
  regionPopulationSchema,
  responseSchema,
  historicalPopulationSchema,
  subdivisionPopulationSchema,
  communePopulationSchema,
} from "./schemas.js";

export const population: FastifyPluginAsync = async (app) => {
  const record = await loadNationalPopulation();
  const regions = await loadRegionPopulation();
  const historical = await loadHistoricalPopulation();
  const subdivisions = await loadSubdivisionPopulation();
  const communes = await loadCommunePopulation();
  app.get("/api/v1/population/national", {
    schema: {
      tags: ["Population"],
      summary: "Get Morocco's national population from the RGPH 2024 snapshot",
      response: {
        200: responseSchema(
          nationalPopulationSchema,
          datasetMetaSchema("national-population"),
        ),
      },
    },
  }, async () => ({
    data: record,
    meta: buildDatasetMeta("national-population", 1),
  }));

  app.get("/api/v1/population/regions", {
    schema: {
      tags: ["Population"],
      summary: "List population totals for Morocco's 12 administrative regions",
      response: {
        200: responseSchema(
          { type: "array", items: regionPopulationSchema },
          datasetMetaSchema("regional-population"),
        ),
      },
    },
  }, async () => ({
    data: regions,
    meta: buildDatasetMeta("regional-population", regions.length),
  }));

  app.get<{ Params: { code: string } }>("/api/v1/population/regions/:code", {
    schema: {
      tags: ["Population"],
      summary: "Get population totals for one administrative region",
      params: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: { type: "string", minLength: 2, maxLength: 80, pattern: "^[a-z0-9-]+$" },
        },
      },
      response: {
        200: responseSchema(
          regionPopulationSchema,
          datasetMetaSchema("regional-population"),
        ),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const region = regions.find((item) => item.code === request.params.code);
    if (!region) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No regional population found for code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return {
      data: region,
      meta: buildDatasetMeta("regional-population", 1),
    };
  });
  app.get("/api/v1/population/historical", {
    schema: {
      tags: ["Population"],
      summary: "Get Morocco's historical population from 1960 to 2024",
      response: {
        200: responseSchema(
          { type: "array", items: historicalPopulationSchema },
          datasetMetaSchema("historical-population"),
        ),
      },
    },
  }, async () => ({
    data: historical,
    meta: buildDatasetMeta("historical-population", historical.length),
  }));
  app.get<{ Params: { year: number } }>("/api/v1/population/historical/:year", {
    schema: {
      tags: ["Population"],
      summary: "Get Morocco's historical population for a specific year",
      params: {
        type: "object",
        additionalProperties: false,
        required: ["year"],
        properties: {
          year: { type: "integer", minimum: 1960, maximum: 2024 },
        },
      },
      response: {
        200: responseSchema(
          historicalPopulationSchema,
          datasetMetaSchema("historical-population"),
        ),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const record = historical.find((item) => item.year === request.params.year);
    if (!record) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No historical population found for year '${request.params.year}'`,
        request_id: request.id,
      } });
    }
    return {
      data: record,
      meta: buildDatasetMeta("historical-population", 1),
    };
  });

  app.get(
    "/api/v1/population/subdivisions",
    {
      schema: {
        tags: ["Population"],
        summary: "List population data for Morocco's provinces and prefectures",
        response: {
          200: responseSchema(
            { type: "array", items: subdivisionPopulationSchema },
            datasetMetaSchema("subdivision-population"),
          ),
        },
      },
    },
    async () => ({
      data: subdivisions,
      meta: buildDatasetMeta("subdivision-population", subdivisions.length),
    }),
  );

  app.get<{ Params: { code: string } }>("/api/v1/population/subdivisions/:code", {
    schema: {
      tags: ["Population"],
      summary: "Get population data for one province or prefecture",
      params: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: { type: "string", minLength: 2, maxLength: 180, pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" },
        },
      },
      response: {
        200: responseSchema(
          subdivisionPopulationSchema,
          datasetMetaSchema("subdivision-population"),
        ),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const subdivision = subdivisions.find((item) => item.code === request.params.code);
    if (!subdivision) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No province or prefecture population found for code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return {
      data: subdivision,
      meta: buildDatasetMeta("subdivision-population", 1),
    };
  });

  app.get("/api/v1/population/communes", {
    schema: {
      tags: ["Population"],
      summary: "List population totals for Morocco's 1,503 communes",
      response: {
        200: responseSchema(
          { type: "array", items: communePopulationSchema },
          datasetMetaSchema("commune-population"),
        ),
      },
    },
  }, async () => ({
    data: communes,
    meta: buildDatasetMeta("commune-population", communes.length),
  }));

  app.get<{ Params: { code: string } }>("/api/v1/population/communes/:code", {
    schema: {
      tags: ["Population"],
      summary: "Get population totals for one commune",
      params: {
        type: "object",
        additionalProperties: false,
        required: ["code"],
        properties: {
          code: { type: "string", minLength: 2, maxLength: 180, pattern: "^[a-z0-9]+(?:-+[a-z0-9]+)*$" },
        },
      },
      response: {
        200: responseSchema(
          communePopulationSchema,
          datasetMetaSchema("commune-population"),
        ),
        400: errorSchema,
        404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const commune = communes.find((item) => item.code === request.params.code);
    if (!commune) {
      return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND",
        message: `No commune population found for code '${request.params.code}'`,
        request_id: request.id,
      } });
    }
    return {
      data: commune,
      meta: buildDatasetMeta("commune-population", 1),
    };
  });
};
