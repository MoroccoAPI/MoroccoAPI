import type { LabourDatasetMeta } from "./types.js";

const producer = "Haut-Commissariat au Plan (HCP), Enquête nationale sur l'emploi";

const sources = [
  {
    dataset: "Taux d'activité selon les Provinces/Préfectures et le Milieu",
    producer,
    source_url: "https://data.gov.ma/data/fr/dataset/data_imt_txact_02",
    resource_url: "https://data.gov.ma/data/dataset/454e0139-311c-41f8-becf-6ce398a3169e/resource/1f7a4d39-2545-4082-b36c-1a9e9a803791/download/i_imt_txact_02_data.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2026-10-30",
  },
  {
    dataset: "Taux d'emploi selon les Provinces/Préfectures et le Milieu",
    producer,
    source_url: "https://data.gov.ma/data/fr/dataset/data_imt_txemp_02",
    resource_url: "https://data.gov.ma/data/dataset/ed1fd781-455c-4560-99e4-6fc52efe1d86/resource/6b4f1e7a-2f4a-42a5-b8ec-14c378534f5d/download/i_imt_txemp_02_data.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2026-10-30",
  },
  {
    dataset: "Taux de chômage selon les Provinces/Préfectures et le Milieu",
    producer,
    source_url: "https://data.gov.ma/data/fr/dataset/data_imt_txch_02",
    resource_url: "https://data.gov.ma/data/dataset/a5f57c4c-f82c-4e0b-afc4-1e09f5de98a4/resource/8ee85745-bf8c-4f50-a094-04c6af0afe4a/download/i_imt_txch_02_data.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2026-10-30",
  },
] as const;

export function buildLabourDatasetMeta(total: number): LabourDatasetMeta {
  return {
    dataset: "population-labour",
    total,
    license: "ODbL-1.0",
    retrieved_at: "2026-11-16",
    transformation_version: "1.0.0",
    sources,
  };
}
