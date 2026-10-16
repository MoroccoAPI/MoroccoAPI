import type { PaginationQuery } from "../common/pagination.js";

export interface Dam {
  id: string;
  name: { fr: string };
  basin: "tensift";
}

export interface DamLevel {
  dam_id: string;
  date: string;
  capacity_mm3: number;
  volume_mm3: number;
  filling_rate_pct: number;
  source_id: string;
  source_ref: { sheet: string; row: number };
}

export interface DamSource {
  id: string;
  resource_url: string;
  source_updated_at: string | null;
  sheet: string;
  period: string;
}

export interface DamManifest {
  id: "tensift-dams";
  title: string;
  producer: string;
  source_url: string;
  source_license: "ODbL-1.0";
  license_url: string;
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
