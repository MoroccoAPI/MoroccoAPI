import type { Territory } from "../indicators/types.js";

export const POVERTY_AREAS = ["all", "urban", "rural"] as const;
export type PovertyArea = (typeof POVERTY_AREAS)[number];

export const POVERTY_YEARS = [2024, 2014] as const;
export type PovertyYear = (typeof POVERTY_YEARS)[number];

export const MPI_TRENDS = ["decrease", "increase", "stagnation", "new_urban_centre"] as const;
export type MpiTrend = (typeof MPI_TRENDS)[number];

export const HEADLINE_FIELDS = ["mpi", "poverty_rate", "poverty_intensity", "vulnerability_rate"] as const;
export const DEPRIVATIONS = [
  "child_mortality",
  "disability",
  "school_attendance",
  "years_of_schooling",
  "electricity",
  "water",
  "sanitation",
  "housing",
  "cooking_fuel",
  "communication_assets",
] as const;
export type HeadlineField = (typeof HEADLINE_FIELDS)[number];
export type Deprivation = (typeof DEPRIVATIONS)[number];
export type PovertyField = HeadlineField | Deprivation;

/** The census territory without its census-only marker. */
export type PovertyTerritory = Omit<Territory, "data_from_local_administration">;

export interface PovertyObservation {
  area: PovertyArea;
  year: PovertyYear;
  mpi: number | null;
  poverty_rate: number | null;
  poverty_intensity: number | null;
  vulnerability_rate: number | null;
  deprivation_rates: Record<Deprivation, number | null>;
  mpi_trend: MpiTrend | null;
  aligned_with_dakhla: boolean;
}

export interface PovertyProfile {
  territory: PovertyTerritory;
  observations: readonly PovertyObservation[];
}

export interface PovertyData {
  territories: readonly PovertyTerritory[];
  /** observations[territory index], aligned with territories; areas without source values are absent. */
  observations: readonly (readonly PovertyObservation[])[];
  excluded: Readonly<{ cercles: number; urban_centres: number }>;
}

export interface PovertyDatasetMeta {
  dataset: "population-poverty";
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
