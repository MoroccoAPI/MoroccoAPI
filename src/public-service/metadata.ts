import type { DatasetMeta } from "./types.js";

// Secondary dataset: compiled by Wadifa Info from the official simulator of the
// Ministry of Digital Transition and Administration Reform. It is not an official
// government release, so every response says so (see issue #15).
const sources = [
  {
    dataset: "Morocco civil-service net salaries by grade (2026)",
    producer: "Wadifa Info (compiled from simulation.mmsp.gov.ma)",
    source_url: "https://doi.org/10.5281/zenodo.23078290",
    resource_url:
      "https://zenodo.org/api/records/23078291/files/morocco_civil_service_net_salaries_2026.csv/content",
    license: "CC-BY-4.0",
    source_updated_at: "2026-10-01",
  },
] as const;

export const SALARY_NOTICE =
  "Simulated reference values compiled by Wadifa Info from the official salary simulator " +
  "(simulation.mmsp.gov.ma), not official salary entitlements. Net monthly pay at the first " +
  "echelon for a single person with no children and no mutuelle, in the highest residence-allowance " +
  "zone; actual pay differs with echelon, location, family situation and specific allowances.";

export function buildDatasetMeta(total: number): DatasetMeta {
  return {
    dataset: "public-service-salaries",
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-10-08",
    transformation_version: "1.0.0",
    value_type: "simulated-reference",
    notice: SALARY_NOTICE,
    sources,
  };
}
