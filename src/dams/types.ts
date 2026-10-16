import type { PaginationQuery } from "../common/pagination.js";

export const damBasins = [
  "bouregreg", "draa-oued-noun", "guir-ziz-gheris", "loukkos", "moulouya",
  "oum-er-rbia", "sebou", "souss-massa", "tensift",
] as const;

export type DamBasin = typeof damBasins[number];
export type DamDateBasis = "source_calendar" | "dashboard_headline";

export interface Dam {
  id: string;
  name: { fr: string | null; ar?: string };
  basin: DamBasin;
}

export interface DamLevel {
  dam_id: string;
  date: string;
  date_basis: DamDateBasis;
  capacity_mm3: number | null;
  volume_mm3: number;
  filling_rate_pct: number;
  previous_year_filling_rate_pct?: number | null;
  source_id: string;
  source_ref: { sheet: string; row: number } | { basin_code: string; dam_index: number };
}

export interface DamSource {
  id: string;
  title: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "ODbL-1.0" | null;
  license_url: string | null;
  source_updated_at: string | null;
  date_basis?: DamDateBasis;
  sheet: string | null;
  period: string;
  source_date?: string;
}

export interface DamManifest {
  id: "morocco-dams";
  title: string;
  producer: string;
  source_url: string | null;
  source_license: "mixed";
  license_url: null;
  retrieved_at: string;
  source_updated_at: string | null;
  transformation_version: string;
  resources: readonly DamSource[];
}

export interface DamData {
  dams: readonly Dam[];
  levels: readonly DamLevel[];
  manifest: DamManifest;
}

export interface DamQuery extends PaginationQuery {
  basin?: string;
}

export interface LevelQuery extends PaginationQuery {
  from?: string;
  to?: string;
}
