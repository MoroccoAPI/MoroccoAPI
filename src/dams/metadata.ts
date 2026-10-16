import type { DamData } from "./types.js";

export function buildDamMeta(snapshot: DamData, total: number, basin?: string) {
  const { manifest, levels } = snapshot;
  const dates = levels.map((level) => level.date).sort();
  const basins = [...new Set(snapshot.dams.map((dam) => dam.basin))].sort();
  return {
    dataset: manifest.id,
    total,
    license: manifest.source_license,
    license_url: manifest.license_url,
    retrieved_at: manifest.retrieved_at,
    source_updated_at: manifest.source_updated_at?.slice(0, 10) ?? null,
    transformation_version: manifest.transformation_version,
    coverage: {
      basin: basin !== undefined && basins.some((value) => value === basin) ? basin : null,
      basins,
      from: dates[0]!,
      to: dates[dates.length - 1]!,
      real_time: false,
      complete_national_coverage: false,
      limitations: [
        "Selected dams across nine basins, including the five-dam Tensift history; not a complete national registry.",
        "Tensift observations use source calendar dates. The Maadialna snapshot uses the dashboard headline date; its JSON has no observation date.",
        "Historical snapshots only; no live levels or interpolation of missing dates.",
        "Maadialna does not publish capacity in this response: capacity_mm3 is null. Its previous-year percentage is a comparison, not a dated observation.",
        "French and Arabic names preserve source spellings; missing translations are null or omitted.",
        "ABHT data is ODbL-1.0. Maadialna provides no explicit reuse license; its source license is null and the combined license is mixed.",
      ],
    },
    sources: manifest.resources.map((source) => ({
      id: source.id,
      dataset: source.title,
      producer: source.producer,
      source_url: source.source_url,
      resource_url: source.resource_url,
      license: source.license,
      license_url: source.license_url,
      date_basis: source.date_basis ?? "source_calendar",
      source_updated_at: source.source_updated_at?.slice(0, 10) ?? null,
    })),
  };
}
