export function responseSchema(
  data: Record<string, unknown>,
  meta: Record<string, unknown>,
) {
  return {
    type: "object", additionalProperties: false, required: ["data", "meta"],
    properties: { data, meta },
  } as const;
}

export const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "request_id"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        request_id: { type: "string" },
      },
    },
  },
} as const;
