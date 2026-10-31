import type { InsuranceManifest } from "./types.js";

export function buildDatasetMeta(total: number, manifest: InsuranceManifest) {
  return {
    dataset: manifest.id,
    total,
    license: manifest.source_license,
    terms_url: manifest.terms_url,
    redistribution_status: manifest.redistribution_status,
    retrieved_at: manifest.retrieved_at,
    source_updated_at: manifest.source_updated_at,
    transformation_version: manifest.transformation_version,
    source_record_count: manifest.source_record_count,
    coverage: { records: manifest.record_count, complete: manifest.coverage_complete },
    real_time: false,
    limitations: manifest.limitations,
    sources: [{ dataset: manifest.title, producer: manifest.producer, source_url: manifest.source_url }],
  };
}
