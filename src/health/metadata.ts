import type { DatasetMeta } from "./types.js";

const geographySource = {
  dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
  producer: "Haut-Commissariat au Plan (HCP)",
  source_url: "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
  resource_url: "https://www.hcp.ma/file/242341/",
  license: "CC-BY-4.0",
  source_updated_at: "2024-11-22",
} as const;

const hospitalSources = [
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
  geographySource,
] as const;

const sources = {
  hospitals: hospitalSources,
  "private-infrastructure": [
    {
      dataset: "Infrastructures privées 2024",
      producer: "Ministère de la Santé et de la Protection Sociale (MSPS)",
      source_url: "https://data.gov.ma/data/fr/dataset/infrastructures-privees-2020",
      resource_url: "https://data.gov.ma/data/fr/dataset/a5853684-b12a-4108-acb1-4a5879cc91e1/resource/233f1d5b-2e3d-4d95-9fe5-4b0df1d715de/download/infrastructures-privees-2024.xlsx",
      license: "ODbL-1.0",
      source_updated_at: "2026-02-06",
    },
    {
      dataset: "Les indicateurs sociaux du Maroc, édition 2026, tableau 4.6 (2024)",
      producer: "Haut-Commissariat au Plan (HCP), statistiques du MSPS",
      source_url: "https://www.hcp.ma/downloads/?tag=Derni%C3%A8res+parutions",
      resource_url: "https://www.hcp.ma/file/248623/",
      license: "CC-BY-4.0",
      source_updated_at: "2026-07-27",
    },
    geographySource,
  ],
  "primary-care-facilities": [
    {
      dataset: "Etablissements de soins de santé primaire 2024",
      producer: "Ministère de la Santé et de la Protection Sociale (MSPS)",
      source_url: "https://data.gov.ma/data/fr/dataset/la-liste-des-hopitaux",
      resource_url: "https://data.gov.ma/data/fr/dataset/2932e8a4-272c-4101-80ef-85519de47e7c/resource/eedbf07a-29fb-4442-b504-37c152ba9402/download/etablissements-de-soins-de-sante-primaire-2024.xlsx",
      license: "ODbL-1.0",
      source_updated_at: "2026-02-06",
    },
    geographySource,
  ],
} as const;

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
    sources: sources[dataset],
  };
}
