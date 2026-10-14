export type PostalPlaceType = "locality" | "neighborhood";

export interface PostalCode {
  postal_code: string;
  type: PostalPlaceType;
  name: string;
  city: string | null;
  province_code: string;
  region_code: string;
  commune_code: string | null;
}

export interface MultiCodeCity {
  name: string;
  province_code: string;
  region_code: string;
  commune_code: string | null;
  postal_codes: readonly string[];
  neighborhood_count: number;
}

export type MultiCodeCitySource = Omit<MultiCodeCity, "postal_codes" | "neighborhood_count">;

export interface PostalData {
  postalCodes: readonly PostalCode[];
  cities: readonly MultiCodeCity[];
}

export interface PostalCodeQuery {
  q?: string;
  type?: PostalPlaceType;
  region_code?: string;
  province_code?: string;
  city?: string;
}

export interface PostalCodeParams {
  code: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "ODbL-1.0" | "CC-BY-4.0";
  source_updated_at: string;
}

export interface DatasetMeta {
  dataset: "postal-codes";
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
