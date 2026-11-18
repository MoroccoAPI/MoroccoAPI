import type { SourceLanguageName } from "../../geography/types.js";

export const LABOUR_AREAS = ["all", "urban", "rural"] as const;
export type LabourArea = (typeof LABOUR_AREAS)[number];

export const LABOUR_FIELDS = ["activity_rate", "employment_rate", "unemployment_rate"] as const;
export type LabourField = (typeof LABOUR_FIELDS)[number];

/** One province or prefecture, area and year; a rate HCP does not publish is null. */
export interface LabourObservation {
  code: string;
  hcp_code: string;
  name: SourceLanguageName;
  region_code: string;
  area: LabourArea;
  year: number;
  activity_rate: number | null;
  employment_rate: number | null;
  unemployment_rate: number | null;
}

export interface LabourData {
  /** Survey years covered by the source, oldest first. */
  years: readonly number[];
  /** Sorted by province code, then area (all, urban, rural), then year (oldest first). */
  observations: readonly LabourObservation[];
}

export interface LabourDatasetMeta {
  dataset: "population-labour";
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly {
    dataset: string;
    producer: string;
    source_url: string;
    resource_url: string;
    license: "ODbL-1.0";
    source_updated_at: string;
  }[];
}
