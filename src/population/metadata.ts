import type { DatasetMeta } from "./types.js";

const sources = [
  {
    dataset:
      "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url:
      "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
    resource_url: "https://www.hcp.ma/file/242342/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-11-22",
  },
  {
    dataset: "Le Maroc en chiffres, 2025 (version arabe _ anglaise)",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url: "https://www.hcp.ma/downloads/?tag=Le+Maroc+en+chiffres",
    resource_url: "https://www.hcp.ma/file/246713/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-11-22",
  },
] as const;

export function buildDatasetMeta(dataset: DatasetMeta["dataset"], total: number): DatasetMeta {
  return {
    dataset,
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-10-05",
    transformation_version: "2.0.0",
    sources,
  };
}
