import type { FastifyPluginAsync } from "fastify";

import { errorSchema, responseSchema } from "../common/schemas.js";
import { checkDate, countBusinessDays, getCalendar, parseDate, supportsDate } from "./calendar.js";
import { MAX_YEAR, MIN_YEAR } from "./data.js";
import { buildCalendarMeta } from "./metadata.js";
import { businessQuerySchema, businessSchema, checkQuerySchema, checkSchema, holidaysSchema, metaSchema, yearParamsSchema } from "./schemas.js";

export const holidays: FastifyPluginAsync = async (app) => {
  const tags = ["Holidays"];
  const description = `Common public-administration calendar, ${MIN_YEAR}–${MAX_YEAR}. Religious dates require official confirmation; missing confirmations are explicitly unknown.`;

  app.get<{ Params: { year: string } }>(
    "/api/v1/holidays/:year",
    { schema: {
      tags, summary: "List Moroccan public holidays for a year", description,
      params: yearParamsSchema,
      response: { 200: responseSchema(holidaysSchema, metaSchema), 400: errorSchema },
    } },
    async (request, reply) => {
      const year = Number(request.params.year);
      if (year < MIN_YEAR || year > MAX_YEAR) {
        return reply.code(400).send({ error: { code: "UNSUPPORTED_YEAR", message: `Supported years are ${MIN_YEAR}–${MAX_YEAR}`, request_id: request.id } });
      }
      const calendar = getCalendar(year);
      return { data: calendar.holidays, meta: buildCalendarMeta([calendar], calendar.holidays.length) };
    },
  );

  app.get<{ Querystring: { date: string } }>(
    "/api/v1/holidays/check",
    { schema: {
      tags, summary: "Check whether a civil date is a holiday or business day", description,
      querystring: checkQuerySchema,
      response: { 200: responseSchema(checkSchema, metaSchema), 400: errorSchema },
    } },
    async (request, reply) => {
      if (!supportsDate(request.query.date)) {
        return reply.code(400).send({ error: { code: "INVALID_DATE", message: `Use a real YYYY-MM-DD date in ${MIN_YEAR}–${MAX_YEAR}`, request_id: request.id } });
      }
      const calendar = getCalendar(Number(request.query.date.slice(0, 4)));
      const data = checkDate(request.query.date, calendar);
      return { data, meta: buildCalendarMeta([calendar], data.holidays.length) };
    },
  );

  app.get<{ Querystring: { from: string; to: string } }>(
    "/api/v1/business-days",
    { schema: {
      tags, summary: "Count business days in an inclusive civil-date range",
      description: `${description} Saturday/Sunday weekends. At most 366 days. business_days is null when unknown holidays could affect the count; business_days_upper_bound excludes known closures.`,
      querystring: businessQuerySchema,
      response: { 200: responseSchema(businessSchema, metaSchema), 400: errorSchema },
    } },
    async (request, reply) => {
      const { from, to } = request.query;
      if (!supportsDate(from) || !supportsDate(to)) {
        return reply.code(400).send({ error: { code: "INVALID_DATE", message: `Use real YYYY-MM-DD dates in ${MIN_YEAR}–${MAX_YEAR}`, request_id: request.id } });
      }
      if (from > to || (parseDate(to)! - parseDate(from)!) / 86_400_000 + 1 > 366) {
        return reply.code(400).send({ error: { code: "INVALID_DATE_RANGE", message: "from must not exceed to; the inclusive range must contain at most 366 days", request_id: request.id } });
      }
      const calendars = [];
      for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) calendars.push(getCalendar(year));
      return { data: countBusinessDays(from, to, calendars), meta: buildCalendarMeta(calendars, 1) };
    },
  );
};
