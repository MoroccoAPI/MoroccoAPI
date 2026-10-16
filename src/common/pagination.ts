import { responseSchema } from "./schemas.js";
import { assertSafeIntegerInRange } from "./validation.js";

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 500;
export const MAX_PAGE_OFFSET = 2_147_483_647;

const paginationProperties = {
  limit: {
    type: "integer", minimum: 1, maximum: MAX_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
    description: "Maximum records to return. Every collection response is paginated; omitting limit returns at most 100 records.",
  },
  offset: {
    type: "integer", minimum: 0, maximum: MAX_PAGE_OFFSET,
    default: 0,
    description: "Number of matching records to skip, after filtering. Defaults to zero.",
  },
} as const;

const paginationMetaSchema = {
  type: "object", additionalProperties: false,
  required: ["limit", "offset", "count", "has_more", "next_offset"],
  properties: {
    limit: { type: "integer", minimum: 1, maximum: MAX_PAGE_LIMIT },
    offset: { type: "integer", minimum: 0, maximum: MAX_PAGE_OFFSET },
    count: { type: "integer", minimum: 0, maximum: MAX_PAGE_LIMIT },
    has_more: { type: "boolean" },
    next_offset: { anyOf: [{ type: "integer", minimum: 0, maximum: MAX_PAGE_OFFSET }, { type: "null" }] },
  },
} as const;

export function paginationQuerySchema(
  schema: { properties: Record<string, unknown>; [key: string]: unknown } = {
    type: "object", additionalProperties: false, properties: {},
  },
) {
  return {
    ...schema,
    properties: { ...schema.properties, ...paginationProperties },
  };
}

export function collectionResponseSchema(
  itemSchema: Record<string, unknown>,
  metaSchema: { properties: Record<string, unknown>; required: readonly string[]; [key: string]: unknown },
) {
  return responseSchema({ type: "array", items: itemSchema }, {
    ...metaSchema,
    required: [...metaSchema.required, "pagination"],
    properties: { ...metaSchema.properties, pagination: paginationMetaSchema },
  });
}

/** Every collection response is bounded, including requests without parameters. */
export function paginate<T, M extends { total: number }>(
  records: readonly T[],
  meta: M,
  query: PaginationQuery,
) {
  const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = query.offset ?? 0;
  assertSafeIntegerInRange(limit, "limit", 1, MAX_PAGE_LIMIT);
  assertSafeIntegerInRange(offset, "offset", 0, MAX_PAGE_OFFSET);
  const data = records.slice(offset, offset + limit);
  const nextOffset = offset + data.length;
  const hasMore = nextOffset < records.length;

  return {
    data,
    meta: {
      ...meta,
      pagination: {
        limit, offset, count: data.length,
        has_more: hasMore,
        next_offset: hasMore ? nextOffset : null,
      },
    },
  };
}
