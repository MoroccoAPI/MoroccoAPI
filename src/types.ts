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
