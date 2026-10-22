import type { IndicatorDatasetMeta } from "./types.js";

const sources = [
  {
    dataset: "Indicateurs démographiques et socioéconomiques du Royaume du Maroc selon les résultats du RGPH 2024",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url: "https://www.hcp.ma/downloads/RGPH-2024_t22752.html",
    resource_url: "https://www.hcp.ma/file/242671/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-12-17",
  },
] as const;

export function buildIndicatorDatasetMeta(total: number): IndicatorDatasetMeta {
  return {
    dataset: "population-indicators",
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-10-20",
    transformation_version: "1.0.1",
    sources,
  };
}
