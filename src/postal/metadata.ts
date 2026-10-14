import type { DatasetMeta } from "./types.js";

const localitiesPage = "https://data.gov.ma/data/fr/dataset/codes-postaux-des-localites";

const sources = [
  {
    dataset: "Codes postaux des localités 2018",
    producer: "Barid Al-Maghrib (Poste Maroc)",
    source_url: localitiesPage,
    resource_url: "https://data.gov.ma/data/fr/dataset/c90aaa8f-5ad0-41d3-a9d2-f8f87ec538e0/resource/3aa9c2ce-bd68-4f91-86af-d4eeb3b8e6d1/download/codes-postaux-localites-2018.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2017-12-18",
  },
  {
    dataset: "Codes postaux des villes (villes multicodes)",
    producer: "Barid Al-Maghrib (Poste Maroc)",
    source_url: localitiesPage,
    resource_url: "https://data.gov.ma/data/fr/dataset/c90aaa8f-5ad0-41d3-a9d2-f8f87ec538e0/resource/a42d7771-ec9d-4124-b631-c9177031432e/download/codes-postaux-des-villes-2018.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2017-12-18",
  },
  {
    dataset: "Codes postaux des quartiers au Maroc",
    producer: "Barid Al-Maghrib (Poste Maroc)",
    source_url: "https://data.gov.ma/data/fr/dataset/codes-postaux-des-quartiers",
    resource_url: "https://data.gov.ma/data/fr/dataset/e0093dbf-38f0-440a-91da-ad3f0243f378/resource/7f257007-d512-4a2e-9f7f-ba29ee4ac8b1/download/codes-postaux-quartiers-2018.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2017-12-18",
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

export function buildDatasetMeta(total: number): DatasetMeta {
  return {
    dataset: "postal-codes",
    total,
    license: "ODbL-1.0",
    retrieved_at: "2026-10-14",
    transformation_version: "1.0.0",
    sources,
  };
}
