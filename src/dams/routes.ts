import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema } from "../common/pagination.js";
import { errorSchema } from "../common/schemas.js";
import { loadDams } from "./data.js";
import { isObservationDate } from "./dates.js";
import { buildDamMeta } from "./metadata.js";
import { damLevelSchema, damMetaSchema, damParamsSchema, damQuerySchema, damSchema, levelQuerySchema } from "./schemas.js";
import type { DamData, DamLevel, DamQuery, LevelQuery } from "./types.js";

export const dams: FastifyPluginAsync = async (app) => {
  const snapshot = await loadDams();
  await registerDamRoutes(app, snapshot);
  await registerLevelRoutes(app, snapshot);
};

async function registerDamRoutes(app: FastifyInstance, snapshot: DamData): Promise<void> {
  const latestLevels = new Map<string, DamLevel>();
  for (const level of snapshot.levels) {
    const previous = latestLevels.get(level.dam_id);
    if (!previous || previous.date < level.date) latestLevels.set(level.dam_id, level);
  }
  const dams = snapshot.dams.map((dam) => ({ ...dam, latest_level: latestLevels.get(dam.id)! }));

  app.get<{ Querystring: DamQuery }>(
    "/api/v1/dams",
    {
      schema: {
        tags: ["Water"],
        summary: "List selected dams across Morocco with their latest available observation",
        querystring: paginationQuerySchema(damQuerySchema),
        response: {
          200: collectionResponseSchema(damSchema, damMetaSchema),
          400: errorSchema,
        },
      },
    },
    async (request) => {
      const data = request.query.basin ? dams.filter((dam) => dam.basin === request.query.basin) : dams;
      return paginate(data, buildDamMeta(snapshot, data.length, request.query.basin), request.query);
    },
  );
}

async function registerLevelRoutes(app: FastifyInstance, snapshot: DamData): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: LevelQuery }>(
    "/api/v1/dams/:id/levels",
    {
      schema: {
        tags: ["Water"],
        summary: "Get published water storage and filling-rate snapshots for one dam",
        description: "Filter inclusively with ISO dates from and to. Observations are sorted oldest first. date_basis distinguishes source calendar dates from the Maadialna dashboard headline date; its JSON has no observation date. No interpolation.",
        params: damParamsSchema,
        querystring: paginationQuerySchema(levelQuerySchema),
        response: {
          200: collectionResponseSchema(damLevelSchema, damMetaSchema),
          400: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { from, to } = request.query;
      if ((from !== undefined && !isObservationDate(from)) ||
          (to !== undefined && !isObservationDate(to)) || (from && to && from > to)) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Use valid ISO dates with 'from' on or before 'to'",
            request_id: request.id,
          },
        });
      }
      const dam = snapshot.dams.find((item) => item.id === request.params.id);
      if (!dam) {
        return reply.code(404).send({
          error: {
            code: "RESOURCE_NOT_FOUND",
            message: `No dam found for id '${request.params.id}'`,
            request_id: request.id,
          },
        });
      }
      const data = snapshot.levels.filter((level) => level.dam_id === request.params.id &&
        (!from || level.date >= from) && (!to || level.date <= to))
        .sort((left, right) => left.date.localeCompare(right.date));
      return paginate(data, buildDamMeta(snapshot, data.length, dam.basin), request.query);
    },
  );
}
