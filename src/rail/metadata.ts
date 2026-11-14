import type { StationManifest } from "./types.js";

export function buildDatasetMeta(manifest: StationManifest, total: number) {
  const source = manifest.source;
  return {
    dataset: source.id, total, license: source.license, license_url: source.license_url,
    attribution: source.attribution, snapshot_at: source.snapshot_at, retrieved_at: source.retrieved_at,
    transformation_version: manifest.transformation_version,
    source_record_count: manifest.raw_record_count, snapshot_record_count: manifest.record_count,
    scope: "Station and halt features in the Geofabrik Morocco extract, including explicitly mapped inactive or planned sites; explicit non-train modes excluded.",
    limitations: [
      "Community mapping, not an official ONCF station inventory. Coverage and current passenger service are not verified.",
      "snapshot_at is the extract timestamp. sources[].updated_at is an OSM edit timestamp, not an on-site verification date.",
      "city uses only an explicit addr:city or is_in:city source tag; missing cities and translations remain null. No nearest-city guess or HCP join is made.",
      "osm_status reflects explicit OSM lifecycle tags. unknown does not mean operational; construction and proposed sites are not open stations.",
      "When current railway and lifecycle-prefixed facility types conflict, the current type is retained with unknown lifecycle; conflicts are listed in the source manifest.",
      "Non-point locations are bounding-box centers, not entrances or platform positions. Source coordinates may be inaccurate.",
      "Only reviewed duplicate representations are merged; other duplicates and mapping errors may remain.",
      "passenger_service and connections are null: no licensed current service feed is integrated. Track geometry is not proof of a direct train.",
    ],
    sources: [{
      producer: source.producer, source_url: source.source_url, resource_url: source.resource_url,
      license: source.license, source_updated_at: source.snapshot_at, sha256: source.pbf_sha256,
    }],
  };
}
