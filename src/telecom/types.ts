export interface Operator {
  code: string;
  name: string;
}

export interface NumberingRange {
  prefix: string;
  international_prefix: string;
  mask: string;
  category: "carrier" | "geographic";
  original_operator: Operator | null;
  area_code: string | null;
  more_specific_prefixes: readonly string[];
}

export interface AreaCode {
  code: string;
  international_prefix: string;
  description: { ar: null; fr: string; en: string };
  areas: { ar: null; fr: readonly string[]; en: readonly string[] };
  hcp_code: null;
}

export interface TelecomData {
  ranges: readonly NumberingRange[];
  areas: readonly AreaCode[];
}

export interface NumberValidation {
  is_possible: boolean;
  is_valid_format: boolean;
  is_allocated_range: null;
  has_known_prefix: boolean;
  e164: string | null;
  national_number: string | null;
  number_type: string | null;
  reason: "INVALID_CHARACTERS" | "INVALID_LENGTH" | "NOT_MOROCCAN" | "INVALID_NUMBER_PATTERN" | null;
}

export interface NumberLookup extends NumberValidation {
  matched_prefix: string | null;
  original_operator: Operator | null;
  current_operator: null;
  geographic_area: AreaCode | null;
}

export interface NumberQuery {
  number: string;
}

export interface RangeQuery {
  prefix?: string;
  operator?: string;
  category?: NumberingRange["category"];
}

export interface AreaCodeQuery {
  prefix?: string;
}

export interface PrefixParams {
  prefix: string;
}

export interface AreaCodeParams {
  code: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "Apache-2.0";
  source_updated_at: string | null;
}

export interface DatasetMeta {
  dataset: "phone-numbers" | "numbering-ranges" | "area-codes";
  total: number;
  license: "Apache-2.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
