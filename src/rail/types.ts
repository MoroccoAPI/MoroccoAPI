export const stationTypes = ["station", "halt"] as const;
export const stationStatuses = ["unknown", "disused", "abandoned", "construction", "proposed", "demolished"] as const;
export type StationType = typeof stationTypes[number];
export type StationStatus = typeof stationStatuses[number];
export type OsmType = "node" | "way" | "relation";

export interface StationSource {
  osm_type: OsmType;
  osm_id: number;
  version: number;
  updated_at: string;
  url: string;
  fields: string[];
}

export interface Station {
  id: string;
  name: string | null;
  names: { ar: string | null; fr: string | null; en: string | null };
  aliases: string[];
  type: StationType;
  city: string | null;
  operator: string | null;
  network: string | null;
  location: { latitude: number; longitude: number; method: "osm_point" | "bounding_box_center" };
  osm_status: StationStatus;
  wikidata_id: string | null;
  passenger_service: null;
  connections: null;
  sources: StationSource[];
}

export interface StationQuery {
  q?: string;
  city?: string;
  type?: StationType;
  status?: StationStatus;
}

export interface StationParams { id: string }

export interface SourceInfo {
  id: string;
  producer: string;
  source_url: string;
  resource_url: string;
  snapshot_at: string;
  replication_sequence: string | null;
  retrieved_at: string;
  pbf_sha256: string;
  pbf_size_bytes: number;
  license: "ODbL-1.0";
  license_url: string;
  attribution: string;
}

export interface RawElement {
  type: OsmType;
  id: number;
  version: number;
  timestamp: string;
  tags: Record<string, string>;
  geometry: { type: string; coordinates: unknown } | null;
}
export interface RawSnapshot { source: SourceInfo; elements: RawElement[] }
export interface StationMappings {
  merges: { primary: string; members: string[]; reason: string }[];
}
export interface StationManifest {
  source: SourceInfo;
  transformation_version: string;
  raw_sha256: string;
  mappings_sha256: string;
  stations_sha256: string;
  raw_record_count: number;
  record_count: number;
  excluded: { id: string; reason: string }[];
  warnings: { id: string; reason: string }[];
  merged: StationMappings["merges"];
  coverage: { named: number; name_ar: number; name_fr: number; city: number };
}
