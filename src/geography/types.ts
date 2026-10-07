export interface RegionName {
  ar: string;
  fr: string;
  en: string;
}

export interface Region {
  code: string;
  hcp_code: string;
  type: "region";
  name: RegionName;
}

export interface SourceLanguageName {
  ar: string;
  fr: string;
  en: string | null;
}

export interface Province {
  code: string;
  hcp_code: string;
  type: "province_or_prefecture";
  administrative_type: "province" | "prefecture";
  name: SourceLanguageName;
  region_code: string;
}

export interface Commune {
  code: string;
  hcp_code: string;
  type: "commune";
  name: SourceLanguageName;
  cercle_hcp_code: string | null;
  province_code: string;
  region_code: string;
}

export interface PrefectureOfArrondissements {
  code: string;
  hcp_code: string;
  type: "prefecture_of_arrondissements";
  name: SourceLanguageName;
  province_code: string;
  region_code: string;
}

export interface Arrondissement {
  code: string;
  hcp_code: string;
  type: "arrondissement";
  name: SourceLanguageName;
  commune_code: string;
  prefecture_of_arrondissements_code: string | null;
  province_code: string;
  region_code: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "CC-BY-4.0";
  source_updated_at: string;
}

export interface DatasetMeta {
  dataset:
    | "administrative-regions"
    | "administrative-provinces"
    | "administrative-prefectures-of-arrondissements"
    | "administrative-communes"
    | "administrative-arrondissements";
  total: number;
  license: "CC-BY-4.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}

export interface GeographyData {
  provinces: readonly Province[];
  prefecturesOfArrondissements: readonly PrefectureOfArrondissements[];
  communes: readonly Commune[];
  arrondissements: readonly Arrondissement[];
}

export interface GeographySnapshot extends GeographyData {
  regions: readonly Region[];
}

export interface ResourceParams {
  code: string;
}
