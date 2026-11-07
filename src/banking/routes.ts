import type { FastifyPluginAsync } from "fastify";
import { collectionResponseSchema, paginate, paginationQuerySchema, type PaginationQuery } from "../common/pagination.js";
import { errorSchema, responseSchema } from "../common/schemas.js";
import { normalizeSearch } from "../common/search.js";
import { loadBankingData } from "./data.js";
import { buildBankingMeta } from "./metadata.js";
import { bankCode, bankCodeSchema, bankingMetaSchema, categorySchema, institutionId, institutionSchema, searchSchema } from "./schemas.js";
import type { BankingDataset } from "./types.js";

interface SearchQuery extends PaginationQuery { q?: string; category?: string }

export const banking: FastifyPluginAsync = async (app) => {
  const { data, manifest } = await loadBankingData();
  const tags = ["Banking"];
  const meta = (total: number) => buildBankingMeta(total, manifest);
  const description = "BAM workbooks supplied on 4 November 2026. Labels and addresses are retained as supplied. " +
    "The institution workbook has no explicit reference date; the bank-code filename indicates 3 November 2026. " +
    "The two lists are separate snapshots, without inferred joins, SWIFT/BIC codes or live authorization checks. " +
    "BAM charter section V applies: attribution and copy date are required; commercial reuse requires written permission.";
  const collections = [
    { path: "institutions", records: data.institutions, schema: institutionSchema, summary: "List credit institutions and related bodies with their head-office addresses" },
    { path: "bank-codes", records: data.bank_codes, schema: bankCodeSchema, summary: "List the three-digit bank codes supplied by Bank Al-Maghrib" },
  ] as const;

  for (const collection of collections) {
    const searchable = collection.records.map((record) => ({ record, search: normalizeSearch([
      record.name, "head_office_address" in record ? record.head_office_address : "", "code" in record ? record.code : "",
    ].join(" ")) }));
    app.get<{ Querystring: SearchQuery }>(`/api/v2/banking/${collection.path}`, {
      schema: {
        tags, summary: collection.summary, description,
        querystring: paginationQuerySchema(searchSchema(data.categories.filter(category => category.dataset === collection.path).map(category => category.code))),
        response: { 200: collectionResponseSchema(collection.schema, bankingMetaSchema), 400: errorSchema },
      },
    }, async (request, reply) => {
      const query = request.query.q === undefined ? undefined : normalizeSearch(request.query.q);
      if (query !== undefined && query.length < 2) return reply.code(400).send({ error: {
        code: "VALIDATION_ERROR", message: "q must contain at least two non-whitespace characters", request_id: request.id,
      } });
      // Source records are built once at startup; filtering keeps references to those immutable objects.
      const matches = query === undefined && request.query.category === undefined ? collection.records :
        searchable.filter(item => (query === undefined || item.search.includes(query)) &&
          (request.query.category === undefined || item.record.category_code === request.query.category)).map(item => item.record);
      return paginate(matches, meta(matches.length), request.query);
    });
  }
  const institutions = new Map(data.institutions.map(record => [record.id, record]));
  app.get<{ Params: { id: string } }>("/api/v2/banking/institutions/:id", {
    schema: { tags, summary: "Get an institution by its MoroccoAPI identifier", description,
      params: { type: "object", required: ["id"], additionalProperties: false, properties: { id: institutionId } },
      querystring: { type: "object", additionalProperties: false, properties: {} },
      response: { 200: responseSchema(institutionSchema, bankingMetaSchema), 400: errorSchema, 404: errorSchema } },
  }, async (request, reply) => {
    const record = institutions.get(request.params.id);
    if (!record) return reply.code(404).send({ error: { code: "RESOURCE_NOT_FOUND", message: "Institution not found", request_id: request.id } });
    return { data: record, meta: meta(1) };
  });
  const codes = new Map(data.bank_codes.map(record => [record.code, record]));
  app.get<{ Params: { code: string } }>("/api/v2/banking/bank-codes/:code", {
    schema: { tags, summary: "Look up an exact three-digit BAM bank code", description,
      params: { type: "object", required: ["code"], additionalProperties: false, properties: { code: bankCode } },
      querystring: { type: "object", additionalProperties: false, properties: {} },
      response: { 200: responseSchema(bankCodeSchema, bankingMetaSchema), 400: errorSchema, 404: errorSchema } },
  }, async (request, reply) => {
    const record = codes.get(request.params.code);
    if (!record) return reply.code(404).send({ error: { code: "RESOURCE_NOT_FOUND", message: "Bank code not found", request_id: request.id } });
    return { data: record, meta: meta(1) };
  });
  app.get<{ Querystring: { dataset?: BankingDataset } & PaginationQuery }>("/api/v2/banking/categories", {
    schema: { tags, summary: "List each workbook's categories and record counts", description,
      querystring: paginationQuerySchema({ type: "object", additionalProperties: false, properties: {
        dataset: { type: "string", enum: ["institutions", "bank-codes"], description: "Choose the workbook whose category codes you need." },
      } }), response: { 200: collectionResponseSchema(categorySchema, bankingMetaSchema), 400: errorSchema } },
  }, async request => {
    const categories = request.query.dataset === undefined ? data.categories : data.categories.filter(category => category.dataset === request.query.dataset);
    return paginate(categories, meta(categories.length), request.query);
  });
};
