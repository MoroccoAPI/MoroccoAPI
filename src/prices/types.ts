export const PRODUCT_LEVELS = ["general", "division", "group", "class"] as const;
export type ProductLevel = typeof PRODUCT_LEVELS[number];

export interface CpiCity {
  code: string;
  name: string;
  region_code: string | null;
  product_count: number;
  first_month: string;
  last_month: string;
}

export interface CpiProduct {
  code: string;
  name: string;
  level: ProductLevel;
  parent_code: string | null;
  city_count: number;
}

/** One city and product, with its monthly index values oldest first (one per month of `months`). */
export interface CpiSeries {
  city_code: string;
  product_code: string;
  values: readonly number[];
}

export interface CpiObservation {
  city_code: string;
  product_code: string;
  product_name: string;
  level: ProductLevel;
  month: string;
  index: number;
}

export interface CpiData {
  /** Every published month, oldest first, as YYYY-MM. */
  months: readonly string[];
  cities: readonly CpiCity[];
  products: readonly CpiProduct[];
  /** Ordered by city (source order), then product (nomenclature order). */
  series: readonly CpiSeries[];
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
  dataset: "prices-cpi";
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
