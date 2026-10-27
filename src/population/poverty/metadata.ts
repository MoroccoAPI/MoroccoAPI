import type { PovertyDatasetMeta } from "./types.js";

const sources = [
  {
    dataset: "Base de données (Excel) de la cartographie de la pauvreté multidimensionnelle, paysage territorial et dynamique, Mai 2025",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url: "https://www.hcp.ma/Cartographie-de-la-pauvrete-multidimensionnelle-paysage-territorial-et-dynamique-Mai-2025_a4104.html",
    resource_url: "https://www.hcp.ma/file/245096/",
    license: "CC-BY-4.0",
    source_updated_at: "2025-10-27",
  },
] as const;

export function buildPovertyDatasetMeta(total: number): PovertyDatasetMeta {
  return {
    dataset: "population-poverty",
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-10-26",
    transformation_version: "1.0.0",
    sources,
  };
}
