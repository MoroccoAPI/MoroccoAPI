import type { FastifyPluginAsync } from "fastify";

import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema } from "../common/schemas.js";
import type { GeographySnapshot } from "../geography/types.js";
import { loadCpi } from "./data/cpi.js";
import { buildDatasetMeta } from "./metadata.js";
import { citySchema, cpiQuerySchema, datasetMetaSchema, observationSchema, productQuerySchema, productSchema } from "./schemas.js";
import type { CpiObservation, ProductLevel } from "./types.js";

interface CpiQuery {
  city?: string;
  product?: string;
  level?: ProductLevel;
  from?: string;
  to?: string;
}

export const prices: FastifyPluginAsync<{ geography: GeographySnapshot }> = async (app, { geography }) => {
  const { months, cities, products, series } = await loadCpi(geography);
  const tags = ["Prices"];
  const metaSchema = datasetMetaSchema();
  const source = `HCP monthly consumer price index, base 100 = average of 2017, from ${months[0]} to ${months.at(-1)}, for Morocco and 18 cities. Values are published as indices, not inflation rates.`;
  const productByCode = new Map(products.map((product) => [product.code, product]));

  app.get<{ Querystring: CpiQuery & PaginationQuery }>("/api/v2/prices/cpi", {
    schema: {
      tags, summary: "List monthly consumer price index values for a city, a product or both",
      description: `Give city, product or both; level, from and to narrow the result. Rows are ordered by city, product and month, oldest first. ${source}`,
      querystring: paginationQuerySchema(cpiQuerySchema(cities.map((city) => city.code), products.map((product) => product.code))),
      response: { 200: collectionResponseSchema(observationSchema, metaSchema), 400: errorSchema },
    },
  }, async (request, reply) => {
    const { city, product, level, from, to } = request.query;
    if (city === undefined && product === undefined) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "Provide city, product or both", request_id: request.id,
      } });
    }
    if (from !== undefined && to !== undefined && from > to) {
      return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "from must not be after to", request_id: request.id,
      } });
    }
    // YYYY-MM strings sort chronologically.
    const first = from === undefined ? 0 : months.findIndex((month) => month >= from);
    const last = to === undefined ? months.length - 1 : months.findLastIndex((month) => month <= to);
    const rows: CpiObservation[] = [];
    for (const item of first < 0 ? [] : series) {
      const info = productByCode.get(item.product_code)!;
      if ((city !== undefined && item.city_code !== city) || (product !== undefined && item.product_code !== product) ||
        (level !== undefined && info.level !== level)) continue;
      for (let index = first; index <= last; index++) {
        rows.push({
          city_code: item.city_code, product_code: item.product_code, product_name: info.name, level: info.level,
          month: months[index]!, index: item.values[index]!,
        });
      }
    }
    return paginate(rows, buildDatasetMeta(rows.length), request.query);
  });

  app.get<{ Querystring: { level?: ProductLevel } & PaginationQuery }>("/api/v2/prices/cpi/products", {
    schema: {
      tags, summary: "List the products of the consumer price index: general index, divisions, groups and classes",
      description: `Nomenclature order, each product followed by the products one level below it. ${source}`,
      querystring: paginationQuerySchema(productQuerySchema),
      response: { 200: collectionResponseSchema(productSchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => {
    const { level } = request.query;
    const matches = level === undefined ? products : products.filter((product) => product.level === level);
    return paginate(matches, buildDatasetMeta(matches.length), request.query);
  });

  app.get<{ Querystring: PaginationQuery }>("/api/v2/prices/cpi/cities", {
    schema: {
      tags, summary: "List the national index and the 18 cities of the consumer price index",
      description: `HCP order, starting with the national index. ${source}`,
      querystring: paginationQuerySchema(),
      response: { 200: collectionResponseSchema(citySchema, metaSchema), 400: errorSchema },
    },
  }, async (request) => paginate(cities, buildDatasetMeta(cities.length), request.query));
};
