import type { Commune, Province, Region } from "../geography/types.js";

export interface NationalPopulation {
  total: number;
  moroccans: number;
  foreigners: number;
  urban: PopulationBreakdown;
  rural: PopulationBreakdown;
}

export interface RegionPopulation extends Region {
  population: number;
  moroccans: number;
  foreigners: number;
  urban: number;
  rural: number;
}

export interface SubdivisionPopulation extends Province {
  population: number;
  moroccans: number;
  foreigners: number;
  households: number;
}

export interface CommunePopulation extends Commune {
  population: number;
  moroccans: number;
  foreigners: number;
  households: number;
}

export interface PopulationBreakdown {
  total: number;
  moroccans: number;
  foreigners: number;
}

export interface HistoricalPopulation {
  year: number;
  total: number;
  urban: number;
  rural: number;
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
  dataset:
    | "national-population"
    | "regional-population"
    | "historical-population"
    | "subdivision-population"
    | "commune-population";
  total: number;
  license: "CC-BY-4.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly DatasetSource[];
}
