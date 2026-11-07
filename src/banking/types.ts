export type BankingDataset = "institutions" | "bank-codes";

export interface SourceReference { sheet: string; row: number }
export interface Institution {
  id: string;
  name: string;
  category_code: string;
  category_name: string;
  head_office_address: string;
  source_ref: SourceReference;
}
export interface BankCode {
  code: string;
  name: string;
  category_code: string;
  category_name: string;
  source_ref: SourceReference;
}
export interface BankingCategory {
  dataset: BankingDataset;
  code: string;
  name: string;
  count: number;
}
export interface BankingSource {
  dataset: BankingDataset;
  filename: string;
  sheet: string;
  records: number;
  reference_date: string | null;
  date_basis: string;
  sha256: string;
}
export interface BankingManifest {
  dataset: "bam-banking";
  producer: "Bank Al-Maghrib";
  received_at: string;
  copied_at: string;
  transformation_version: string;
  snapshot_sha256: string;
  license: "LicenseRef-BAM-Charte-Diffusion";
  terms_url: string;
  terms_section: string;
  attribution: string;
  notice: string;
  reuse: {
    non_commercial_use: "permitted-with-attribution-and-copy-date";
    commercial_use: "written-permission-required";
    modifications: "disclose-changes-and-BAM-non-liability";
  };
  limitations: readonly string[];
  sources: readonly BankingSource[];
}
export interface BankingSnapshot {
  institutions: readonly Institution[];
  bank_codes: readonly BankCode[];
  categories: readonly BankingCategory[];
}
