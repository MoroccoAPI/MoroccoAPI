import type { DatasetMeta } from "./types.js";

const sources = [
  {
    dataset: "Liste nominative des établissements hospitaliers par catégorie 2024",
    producer: "Ministère de la Santé et de la Protection Sociale (MSPS)",
    source_url: "https://data.gov.ma/data/fr/dataset/repartition-des-etablissements-de-soins-de-sante-primaire-par-categorie-2020",
    resource_url: "https://data.gov.ma/data/fr/dataset/0977885b-7596-4499-9880-bf9f375e3c72/resource/f7e1d345-e95f-4438-aeb0-027153656695/download/repartition-des-hopitaux-par-region-et-province-2024.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2026-02-06",
  },
  {
    dataset: "OpenStreetMap Morocco hospital features (2026-10-05)",
    producer: "OpenStreetMap contributors / Geofabrik",
    source_url: "https://download.geofabrik.de/africa/morocco.html",
    resource_url: "https://download.geofabrik.de/africa/morocco-261005-free.shp.zip",
    license: "ODbL-1.0",
    source_updated_at: "2026-10-05",
  },
  {
    dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url: "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
    resource_url: "https://www.hcp.ma/file/242341/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-11-22",
  },
] as const;

export function buildDatasetMeta(
  dataset: DatasetMeta["dataset"],
  total: number,
): DatasetMeta {
  return {
    dataset,
    total,
    license: "ODbL-1.0",
    retrieved_at: "2026-10-06",
    transformation_version: "1.0.0",
    sources,
  };
}
