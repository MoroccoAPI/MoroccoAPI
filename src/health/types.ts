import type { HospitalCategory, PrimaryCareCategory } from "./categories.js";
import type { PrivateInfrastructureIndicator } from "./indicators.js";

export interface HospitalLocation {
  latitude: number;
  longitude: number;
}

export interface Hospital {
  id: string;
  name: string;
  aliases: readonly string[];
  category: HospitalCategory | null;
  category_label: string | null;
  ownership: "public" | null;
  region_code: string;
  province_code: string;
  commune_code: string | null;
  arrondissement_code: string | null;
  reference_year: number | null;
  location: HospitalLocation | null;
}

export interface HospitalQuery {
  region_code?: string;
  province_code?: string;
  category?: HospitalCategory;
  q?: string;
}

export interface ResourceParams {
  id: string;
}

export interface PrimaryCareFacility {
  id: string;
  name: string;
  aliases: readonly string[];
  category: PrimaryCareCategory;
  category_label: string;
  ownership: "public";
  region_code: string;
  province_code: string;
  commune_code: string | null;
  arrondissement_code: string | null;
  reference_year: number;
  last_service_event_date: string | null;
}

export interface PrimaryCareQuery {
  region_code?: string;
  province_code?: string;
  category?: PrimaryCareCategory;
  q?: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "ODbL-1.0" | "CC-BY-4.0";
  source_updated_at: string;
}

export interface PrivateInfrastructure extends Record<PrivateInfrastructureIndicator, number | null> {
  geographic_level: "national" | "region";
  region_code: string | null;
  reference_year: number;
}

export interface PrivateInfrastructureQuery {
  region_code?: string;
}

export interface DatasetMeta {
  dataset: "hospitals" | "primary-care-facilities" | "private-infrastructure";
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
