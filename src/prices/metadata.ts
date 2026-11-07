import type { DatasetMeta } from "./types.js";

const sources = [
  {
    dataset: "Indice des prix à la consommation (Mensuel) (Base 100 2017)",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url: "https://data.gov.ma/data/fr/dataset/data_i4166",
    resource_url: "https://data.gov.ma/data/dataset/7582f4fb-f157-414b-814a-4c1b474b8d87/resource/bd692621-d8ba-4463-8d43-e66c3313ae59/download/i_i4166_data.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2026-10-30",
  },
] as const;

export function buildDatasetMeta(total: number): DatasetMeta {
  return {
    dataset: "prices-cpi",
    total,
    license: "ODbL-1.0",
    retrieved_at: "2026-11-06",
    transformation_version: "1.0.0",
    sources,
  };
}
