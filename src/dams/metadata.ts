import type { DamData } from "./types.js";

export function buildDamMeta(snapshot: DamData, total: number) {
  const { manifest, levels } = snapshot;
  const dates = levels.map((level) => level.date).sort();
  return {
    dataset: manifest.id,
    total,
    license: manifest.source_license,
    license_url: manifest.license_url,
    retrieved_at: manifest.retrieved_at,
    source_updated_at: manifest.source_updated_at?.slice(0, 10) ?? null,
    transformation_version: manifest.transformation_version,
    coverage: {
      basin: "tensift",
      from: dates[0]!,
      to: dates[dates.length - 1]!,
      real_time: false,
      limitations: [
        "Five dams in the published Tensift snapshot; not nationwide coverage.",
        "Historical daily observations published in monthly files; not live water levels.",
        "Dates absent from the source are not interpolated. Names preserve French source spellings.",
      ],
    },
    sources: manifest.resources.map((source) => ({
      id: source.id,
      dataset: manifest.title,
      producer: manifest.producer,
      source_url: manifest.source_url,
      resource_url: source.resource_url,
      license: manifest.source_license,
      source_updated_at: source.source_updated_at?.slice(0, 10) ?? null,
    })),
  };
}
