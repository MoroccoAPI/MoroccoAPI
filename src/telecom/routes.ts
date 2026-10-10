import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { loadTelecom } from "./data/prefixes.js";
import { buildDatasetMeta } from "./metadata.js";
import { lookupNumber, validateNumber } from "./numbers.js";
import {
  areaCodeSchema, areaParamsSchema, datasetMetaSchema, numberLookupSchema,
  numberQuerySchema, numberValidationSchema, numberingRangeSchema,
  prefixParamsSchema, prefixQuerySchema, rangeQuerySchema,
} from "./schemas.js";
import type { AreaCodeParams, AreaCodeQuery, NumberQuery, PrefixParams, RangeQuery } from "./types.js";

export const telecom: FastifyPluginAsync = async (app) => {
  const data = await loadTelecom();
  const { ranges, areas } = data;
  const tags = ["Telecom"];
  const numberMetaSchema = datasetMetaSchema("phone-numbers");
  const rangeMetaSchema = datasetMetaSchema("numbering-ranges");
  const areaMetaSchema = datasetMetaSchema("area-codes");

  app.get<{ Querystring: NumberQuery }>(
    "/api/v1/telecom/phone-numbers/validate",
    {
      schema: {
        tags,
        summary: "Validate and normalize a Moroccan phone number locally",
        querystring: numberQuerySchema,
        response: { 200: responseSchema(numberValidationSchema, numberMetaSchema), 400: errorSchema },
      },
    },
    async (request) => ({
      data: validateNumber(request.query.number, data),
      meta: buildDatasetMeta("phone-numbers", 1),
    }),
  );

  app.get<{ Querystring: NumberQuery }>(
    "/api/v1/telecom/phone-numbers/lookup",
    {
      schema: {
        tags,
        summary: "Get original carrier and geographic prefix descriptions",
        description: "Uses offline Google prefix mappings. Does not identify subscribers, active lines, current serving operators or physical locations.",
        querystring: numberQuerySchema,
        response: { 200: responseSchema(numberLookupSchema, numberMetaSchema), 400: errorSchema },
      },
    },
    async (request, reply) => {
      const lookup = lookupNumber(request.query.number, data);
      if (!lookup.is_valid_format) {
        return reply.code(400).send({
          error: { code: "INVALID_PHONE_NUMBER", message: "The number does not match the supported Moroccan numbering format", request_id: request.id },
        });
      }
      return { data: lookup, meta: buildDatasetMeta("phone-numbers", 1) };
    },
  );

  app.get<{ Querystring: RangeQuery }>(
    "/api/v1/telecom/numbering-ranges",
    {
      schema: {
        tags, summary: "List licensed carrier and geographic prefix mappings",
        description: "These are Google mapping prefixes, not an official allocation register. More specific prefixes override broad descriptions.",
        querystring: rangeQuerySchema,
        response: { 200: responseSchema({ type: "array", items: numberingRangeSchema }, rangeMetaSchema), 400: errorSchema },
      },
    },
    async (request) => {
      const { prefix, operator, category } = request.query;
      const matches = ranges.filter((range) =>
        (!prefix || range.prefix.startsWith(prefix)) &&
        (!operator || range.original_operator?.code === operator) &&
        (!category || range.category === category));
      return { data: matches, meta: buildDatasetMeta("numbering-ranges", matches.length) };
    },
  );
  app.get<{ Params: PrefixParams }>(
    "/api/v1/telecom/numbering-ranges/:prefix",
    {
      schema: {
        tags, summary: "Get one exact national mapping prefix",
        params: prefixParamsSchema,
        response: { 200: responseSchema(numberingRangeSchema, rangeMetaSchema), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const range = ranges.find((row) => row.prefix === request.params.prefix);
      if (!range) {
        return reply.code(404).send({
          error: { code: "RESOURCE_NOT_FOUND", message: "No numbering mapping found for this prefix", request_id: request.id },
        });
      }
      return { data: range, meta: buildDatasetMeta("numbering-ranges", 1) };
    },
  );

  app.get<{ Querystring: AreaCodeQuery }>(
    "/api/v1/telecom/area-codes",
    {
      schema: {
        tags, summary: "List geographic prefix descriptions in French and English",
        description: "A prefix can describe multiple areas. Labels are preserved from Google and are not administrative identifiers or physical locations.",
        querystring: prefixQuerySchema,
        response: { 200: responseSchema({ type: "array", items: areaCodeSchema }, areaMetaSchema), 400: errorSchema },
      },
    },
    async (request) => {
      const matches = areas.filter((area) => !request.query.prefix || area.code.startsWith(request.query.prefix));
      return { data: matches, meta: buildDatasetMeta("area-codes", matches.length) };
    },
  );
  app.get<{ Params: AreaCodeParams }>(
    "/api/v1/telecom/area-codes/:code",
    {
      schema: {
        tags, summary: "Get areas associated with one exact national geographic prefix",
        params: areaParamsSchema,
        response: { 200: responseSchema(areaCodeSchema, areaMetaSchema), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const area = areas.find((row) => row.code === request.params.code);
      if (!area) {
        return reply.code(404).send({
          error: { code: "RESOURCE_NOT_FOUND", message: "No area description found for this prefix", request_id: request.id },
        });
      }
      return { data: area, meta: buildDatasetMeta("area-codes", 1) };
    },
  );
};
