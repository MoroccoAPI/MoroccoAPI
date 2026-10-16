export interface IndicatorValue {
  year: number;
  value: number;
}

export interface IndicatorSummary {
  code: string;
  name: string;
  topic_code: string;
  topic: string;
  unit: string | null;
  periodicity: string | null;
  license: "CC-BY-4.0";
  first_year: number;
  last_year: number;
  value_count: number;
}

export interface Indicator extends IndicatorSummary {
  source: string;
  license_url: string;
  citation_note: string | null;
  definition: string | null;
  values: readonly IndicatorValue[];
}

export interface Topic {
  code: string;
  name: string;
  indicator_count: number;
}

export interface ExcludedIndicator {
  code: string;
  name: string;
  license_type: string;
}

export interface WorldBankData {
  indicators: readonly Indicator[];
  topics: readonly Topic[];
  excluded: readonly ExcludedIndicator[];
}

export interface IndicatorQuery {
  q?: string;
  topic?: string;
}

export interface IndicatorParams {
  code: string;
}

export interface ValueRangeQuery {
  from?: number;
  to?: number;
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
  dataset: "world-bank-indicators";
  total: number;
  license: "CC-BY-4.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
