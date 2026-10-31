import type { ConsulateManifest } from "./types.js";

export function buildDatasetMeta(total: number, manifest: ConsulateManifest) {
  return {
    dataset: manifest.id,
    total,
    license: manifest.source_license,
    terms_url: manifest.terms_url,
    redistribution_status: manifest.redistribution_status,
    retrieved_at: manifest.retrieved_at,
    source_updated_at: manifest.source_updated_at,
    transformation_version: manifest.transformation_version,
    coverage: {
      records: manifest.record_count, countries: manifest.countries,
      complete: false, real_time: false, limitations: manifest.limitations,
    },
    sources: [{ dataset: manifest.title, producer: manifest.producer, source_url: manifest.source_url }],
  };
}
