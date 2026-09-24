export interface RegionName {
  ar: string;
  fr: string;
  en: string;
}

export interface Region {
  code: string;
  type: "region";
  name: RegionName;
}

export interface SourceLanguageName {
  ar: string | null;
  fr: string;
  en: string | null;
}

export interface Province {
  code: string;
  type: "province_or_prefecture";
  name: SourceLanguageName;
  region_code: string;
}

export interface Commune {
  code: string;
  type: "commune";
  name: SourceLanguageName;
  province_code: string;
  region_code: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "ODbL-1.0";
  source_updated_at: string;
}

export interface DatasetMeta {
  dataset: "administrative-regions";
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: "1.0.0";
  sources: readonly DatasetSource[];
}

export interface PendingDatasetMeta {
  dataset: "administrative-provinces" | "administrative-communes";
  total: number;
  license: null;
  retrieved_at: "2026-09-24";
  transformation_version: "1.0.0";
  sources: readonly PendingDatasetSource[];
  review_status: "pending";
}

export interface PendingDatasetSource {
  dataset: string;
  producer: "Haut-Commissariat au Plan (HCP)";
  source_url: null;
  resource_url: null;
  license: null;
  source_updated_at: null;
}
