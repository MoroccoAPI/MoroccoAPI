import type { SourceLanguageName } from "../../geography/types.js";

export const INDICATOR_LEVELS = [
  "national",
  "regions",
  "subdivisions",
  "prefectures-of-arrondissements",
  "communes",
  "arrondissements",
] as const;
export type IndicatorLevel = (typeof INDICATOR_LEVELS)[number];

export const SEXES = ["both_sexes", "male", "female"] as const;
export type Sex = (typeof SEXES)[number];

export const INDICATOR_UNITS = [
  "percent",
  "persons",
  "households",
  "years",
  "children-per-woman",
  "persons-per-room",
  "persons-per-household",
  "km",
] as const;
export type IndicatorUnit = (typeof INDICATOR_UNITS)[number];

/** Why a value is null: HCP "." (unavailable), HCP "…" (not applicable), or no column for that sex. */
export type NullReason = "unavailable" | "not_applicable" | "not_published";

export interface LocalizedName {
  fr: string;
  en: string;
  ar: string;
}

export interface IndicatorGroup {
  id: string;
  name: LocalizedName;
}

export interface IndicatorDefinition {
  id: string;
  group: string;
  unit: IndicatorUnit;
  name: LocalizedName;
  source_label: string;
  sexes: readonly Sex[];
}

export interface SexValues {
  both_sexes: number | null;
  male: number | null;
  female: number | null;
  null_reasons: Record<Sex, NullReason | null>;
}

export interface Territory {
  level: IndicatorLevel;
  code: string | null;
  hcp_code: string | null;
  name: SourceLanguageName;
  region_code: string | null;
  province_code: string | null;
  data_from_local_administration: boolean;
}

export type TerritoryValue = Territory & SexValues;

export interface IndicatorProfileEntry extends SexValues {
  id: string;
  group: string;
  unit: IndicatorUnit;
  name: LocalizedName;
}

export interface IndicatorProfile {
  territory: Territory;
  indicators: readonly IndicatorProfileEntry[];
}

export interface PopulationIndicatorsData {
  groups: readonly IndicatorGroup[];
  indicators: readonly IndicatorDefinition[];
  territories: readonly Territory[];
  /** values[territory index][indicator index], aligned with territories and indicators. */
  values: readonly (readonly SexValues[])[];
  excluded: Readonly<{ cercles: number; urban_centres: number }>;
}

export interface IndicatorDatasetMeta {
  dataset: "population-indicators";
  total: number;
  license: "CC-BY-4.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly {
    dataset: string;
    producer: string;
    source_url: string;
    resource_url: string;
    license: "CC-BY-4.0";
    source_updated_at: string;
  }[];
}
