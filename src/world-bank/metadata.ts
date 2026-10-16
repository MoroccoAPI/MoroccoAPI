import type { DatasetMeta } from "./types.js";

/** "Last Updated Date" of the committed bulk file; the loader checks that they match. */
export const WDI_LAST_UPDATED = "2026-10-08";

const catalogUrl = "https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators";

const sources = [
  {
    dataset: "World Development Indicators: Morocco bulk download",
    producer: "The World Bank",
    source_url: catalogUrl,
    resource_url: "https://api.worldbank.org/v2/en/country/MAR?downloadformat=csv",
    license: "CC-BY-4.0",
    source_updated_at: WDI_LAST_UPDATED,
  },
  {
    dataset: "World Development Indicators: series metadata",
    producer: "The World Bank",
    source_url: catalogUrl,
    resource_url: "https://api.worldbank.org/v2/sources/2/series/all/metadata?format=json&per_page=30000",
    license: "CC-BY-4.0",
    source_updated_at: WDI_LAST_UPDATED,
  },
] as const;

export function buildDatasetMeta(total: number): DatasetMeta {
  return {
    dataset: "world-bank-indicators",
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-10-15",
    transformation_version: "1.0.0",
    sources,
  };
}
