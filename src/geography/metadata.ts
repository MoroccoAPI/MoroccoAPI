import type { DatasetMeta } from "./types.js";

const sources = [
  {
    dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url:
      "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
    resource_url: "https://www.hcp.ma/file/242341/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-11-22",
  },
] as const;

export function buildDatasetMeta(dataset: DatasetMeta["dataset"], total: number): DatasetMeta {
  const isRegion = dataset === "administrative-regions";
  return {
    dataset,
    total,
    license: "CC-BY-4.0",
    retrieved_at: isRegion ? "2026-09-25" : "2026-09-26",
    transformation_version: isRegion ? "2.0.0" : "3.1.0",
    sources,
  };
}
