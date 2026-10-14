import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadEducationSchools } from "./data/schools.js";
import { loadUniversityEstablishments } from "./data/universities.js";
import { buildEducationMeta } from "./metadata.js";
import {
  educationMetaSchema,
  idParamsSchema,
  schoolQuerySchema,
  schoolSchema,
  universityQuerySchema,
  universitySchema,
} from "./schemas.js";
import { schoolDatasetRoutes } from "./types.js";
import type { SchoolQuery, UniversityQuery } from "./types.js";

export const education: FastifyPluginAsync = async (app) => {
  const schools = await loadEducationSchools();
  const universities = await loadUniversityEstablishments();
  const tags = ["Education"];

  for (const config of schoolDatasetRoutes) {
    const records = schools.filter((school) => school.category === config.category);
    const url = `/api/v1/education/${config.path}`;
    const metaSchema = educationMetaSchema(config.dataset);

    app.get<{ Querystring: SchoolQuery }>(url, {
      schema: {
        tags,
        summary: `List ${config.label.toLocaleLowerCase("en")}`,
        description: "Source commune, province, and region labels are preserved as published; they are not standardized geography codes.",
        querystring: schoolQuerySchema(),
        response: {
          200: responseSchema({ type: "array", items: schoolSchema }, metaSchema),
          400: errorSchema,
        },
      },
    }, async (request, reply) => {
      const { region, province, commune, search } = request.query;
      const filters = [region, province, commune, search].filter((value): value is string => value !== undefined);
      if (filters.some((value) => normalizeSearch(value).length < 2)) {
        return reply.code(400).send({ error: {
          code: "VALIDATION_ERROR", message: "Text filters must contain at least two non-whitespace characters", request_id: request.id,
        } });
      }
      const matches = records.filter((school) =>
        (region === undefined || normalizeSearch(school.region).includes(normalizeSearch(region))) &&
        (province === undefined || normalizeSearch(school.province).includes(normalizeSearch(province))) &&
        (commune === undefined || normalizeSearch(school.commune).includes(normalizeSearch(commune))) &&
        (search === undefined || [school.name_fr, school.name_ar, school.address_fr ?? "", school.address_ar ?? ""].some((value) =>
          normalizeSearch(value).includes(normalizeSearch(search)))),
      );
      return { data: matches, meta: buildEducationMeta(config.dataset, matches.length) };
    });

    app.get<{ Params: { id: string } }>(`${url}/:id`, {
      schema: {
        tags,
        summary: `Get a ${config.label.toLocaleLowerCase("en")} record by its MoroccoAPI ID`,
        params: idParamsSchema,
        response: { 200: responseSchema(schoolSchema, metaSchema), 400: errorSchema, 404: errorSchema },
      },
    }, async (request, reply) => {
      const school = records.find((item) => item.id === request.params.id);
      if (!school) return reply.code(404).send({ error: {
        code: "RESOURCE_NOT_FOUND", message: `No ${config.label.toLocaleLowerCase("en")} record found for ID '${request.params.id}'`, request_id: request.id,
      } });
      return { data: school, meta: buildEducationMeta(config.dataset, 1) };
    });
  }

  const universityUrl = "/api/v1/education/universites-publiques";
  const universityMetaSchema = educationMetaSchema("universites-publiques");
  app.get<{ Querystring: UniversityQuery }>(universityUrl, {
    schema: {
      tags, summary: "List public university establishments",
      description: "Contains university establishments and enrollment figures for 2023–2024. Contact fields are included only when published in the source.",
      querystring: universityQuerySchema(),
      response: {
        200: responseSchema({ type: "array", items: universitySchema }, universityMetaSchema),
        400: errorSchema,
      },
    },
  }, async (request, reply) => {
    const { city, university, search } = request.query;
    const filters = [city, university, search].filter((value): value is string => value !== undefined);
    if (filters.some((value) => normalizeSearch(value).length < 2)) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "Text filters must contain at least two non-whitespace characters", request_id: request.id,
      } });
    }
    const matches = universities.filter((record) =>
      (city === undefined || normalizeSearch(record.city).includes(normalizeSearch(city))) &&
      (university === undefined || normalizeSearch(record.university_fr).includes(normalizeSearch(university)) ||
        normalizeSearch(record.university_ar).includes(normalizeSearch(university))) &&
      (search === undefined || [record.university_fr, record.university_ar, record.establishment_fr, record.establishment_ar,
        record.abbreviation, record.city, record.address ?? "", record.telephone ?? "", record.fax ?? ""].some((value) =>
        normalizeSearch(value).includes(normalizeSearch(search)))),
    );
    return { data: matches, meta: buildEducationMeta("universites-publiques", matches.length) };
  });

  app.get<{ Params: { id: string } }>(`${universityUrl}/:id`, {
    schema: {
      tags, summary: "Get a public university establishment by its MoroccoAPI ID", params: idParamsSchema,
      response: {
        200: responseSchema(universitySchema, universityMetaSchema),
        400: errorSchema, 404: errorSchema,
      },
    },
  }, async (request, reply) => {
    const university = universities.find((item) => item.id === request.params.id);
    if (!university) return reply.code(404).send({ error: {
      code: "RESOURCE_NOT_FOUND", message: `No university establishment found for ID '${request.params.id}'`, request_id: request.id,
    } });
    return { data: university, meta: buildEducationMeta("universites-publiques", 1) };
  });
};
