export interface Consulate {
  id: string;
  name: { fr: string };
  country: { code: string; name: string };
  city: string;
  address: string | null;
  phones: { raw: string; e164: string | null }[];
  website: string | null;
  source_names: string[];
  quality_flags: string[];
}

export interface ConsulateManifest {
  id: "moroccan-consulates";
  title: string;
  producer: string;
  source_url: string;
  source_license: null;
  terms_url: string;
  redistribution_status: "permission-not-obtained";
  retrieved_at: string;
  source_updated_at: null;
  transformation_version: string;
  raw_record_count: number;
  record_count: number;
  countries: number;
  raw_sha256: string;
  records_sha256: string;
  limitations: string[];
}

export interface ConsulateData {
  consulates: Consulate[];
  manifest: ConsulateManifest;
}
