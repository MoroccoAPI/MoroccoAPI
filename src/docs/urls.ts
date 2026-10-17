import type { Language } from "./content.js";

/** Reference URLs describe placeholders, not actual data record IDs. */
export function docsUrl(language: Language, endpoint: string): string {
  const resource = endpoint.replace(/^\/api\/v2\//, "").split("/").map((part) =>
    part.startsWith("{") && part.endsWith("}") ? `by-${part.slice(1, -1)}` : part,
  ).map(encodeURIComponent).join("/");
  return `/docs/${language}/${resource}`;
}
