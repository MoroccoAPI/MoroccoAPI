export const intermediaryCategories = ["agent", "broker", "direct-office"] as const;
export type IntermediaryCategory = typeof intermediaryCategories[number];

export interface InsuranceIntermediary {
  acaps_code: string;
  name: string | null;
  category: IntermediaryCategory;
  insurer: string | null;
  city: string | null;
}

export interface IntermediaryQuery {
  q?: string;
  city?: string;
  category?: IntermediaryCategory;
}

export interface InsuranceManifest {
  id: "acaps-insurance-intermediaries";
  title: string;
  producer: string;
  source_url: string;
  source_license: null;
  terms_url: string;
  redistribution_status: "permission-not-obtained";
  retrieved_at: string;
  source_updated_at: null;
  transformation_version: string;
  source_record_count: number;
  captured_source_record_count: number;
  record_count: number;
  coverage_complete: boolean;
  records_sha256: string;
  limitations: string[];
}

export interface InsuranceData {
  intermediaries: readonly InsuranceIntermediary[];
  manifest: InsuranceManifest;
}
