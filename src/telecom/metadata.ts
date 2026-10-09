import type { DatasetMeta } from "./types.js";

const sourceRevision = "33be5664343676b27761213d8f5500d682568ea7";
const baseUrl = `https://raw.githubusercontent.com/google/libphonenumber/${sourceRevision}/resources`;

const sources = [
  { dataset: "Original carrier prefix mappings for +212", resource_url: `${baseUrl}/carrier/en/212.txt` },
  { dataset: "Geographic prefix descriptions for +212 in French", resource_url: `${baseUrl}/geocoding/fr/212.txt` },
  { dataset: "Geographic prefix descriptions for +212 in English", resource_url: `${baseUrl}/geocoding/en/212.txt` },
].map((source) => ({
  ...source,
  producer: "The Libphonenumber Authors",
  source_url: "https://github.com/google/libphonenumber",
  license: "Apache-2.0" as const,
  source_updated_at: null,
}));

export function buildDatasetMeta(
  dataset: DatasetMeta["dataset"],
  total: number,
): DatasetMeta {
  return {
    dataset,
    total,
    license: "Apache-2.0",
    retrieved_at: "2026-10-08",
    transformation_version: "1.0.0",
    sources,
  };
}
