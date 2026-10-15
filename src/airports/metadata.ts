export const SOURCE_REVISION = "a5a1ab8c3d9d57568c4bf9a7d398a23a60623830";
export const SNAPSHOT_RECORD_COUNT = 45;

export function buildDatasetMeta(total: number) {
  return {
    dataset: "ourairports-morocco", total, license: "Public-Domain",
    license_url: "https://ourairports.com/data/",
    retrieved_at: "2026-10-15", transformation_version: "1.0.0",
    snapshot_date: "2026-10-14", source_revision: SOURCE_REVISION,
    source_record_count: SNAPSHOT_RECORD_COUNT,
    scope: "OurAirports records tagged iso_country=MA, including heliports and closed sites",
    limitations: [
      "Community-maintained source; not an official government airport registry. Codes, locations and service flags may be inaccurate.",
      "The snapshot date is the upstream file revision, not a verification date for each airport.",
      "OurAirports assigns some airports, including Dakhla and Laayoune, to EH; those records are outside the requested MA filter.",
      "Detail lookup uses only the explicit icao_code field. ident and GPS codes are not promoted to ICAO codes.",
      "municipality and scheduled_service preserve source reports; they do not establish physical city boundaries or current operation.",
    ],
    sources: [{
      dataset: "OurAirports airports.csv", producer: "OurAirports contributors",
      source_url: "https://ourairports.com/data/",
      resource_url: `https://raw.githubusercontent.com/davidmegginson/ourairports-data/${SOURCE_REVISION}/airports.csv`,
      license: "Public-Domain", source_updated_at: "2026-10-14",
    }],
  };
}
