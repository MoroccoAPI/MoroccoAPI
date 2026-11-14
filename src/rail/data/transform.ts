import type { RawElement, RawSnapshot, Station, StationMappings, StationStatus, StationType } from "../types.js";

export const TRANSFORMATION_VERSION = "1.0.0";
export const osmId = (element: Pick<RawElement, "type" | "id">): string => `osm-${element.type}-${element.id}`;
const lifecycles = ["demolished", "razed", "abandoned", "disused", "construction", "proposed"] as const;
const clean = (value: string | undefined): string | null => value?.trim() || null;

function classification(tags: Record<string, string>): { type: StationType; status: StationStatus; conflict?: string } | null {
  const base = tags.railway;
  for (const state of lifecycles) {
    const value = tags[`${state}:railway`];
    if ((base === "station" || base === "halt") && (value === "station" || value === "halt") && base !== value) {
      // A former station may now be a halt: do not apply the old facility's
      // lifecycle to the differently classified current feature.
      return { type: base, status: "unknown", conflict: `railway=${base} conflicts with ${state}:railway=${value}; current lifecycle unresolved` };
    }
    const type = value === "station" || value === "halt" ? value
      : tags[state] === "yes" && (base === "station" || base === "halt") ? base : null;
    if (type) return { type, status: state === "razed" ? "demolished" : state };
  }
  return base === "station" || base === "halt" ? { type: base, status: "unknown" } : null;
}

function position(element: RawElement): Station["location"] | null {
  if (!element.geometry) return null;
  const { type, coordinates } = element.geometry;
  if (!["Point", "LineString", "Polygon", "MultiPolygon"].includes(type)) throw new Error(`Unsupported geometry: ${osmId(element)}`);
  const points: number[][] = [];
  function visit(value: unknown): void {
    if (!Array.isArray(value) || !value.length) throw new Error(`Invalid geometry: ${osmId(element)}`);
    if (typeof value[0] === "number") {
      if (value.length !== 2 || !value.every(Number.isFinite) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) {
        throw new Error(`Invalid coordinates: ${osmId(element)}`);
      }
      points.push(value as number[]);
    } else value.forEach(visit);
  }
  visit(coordinates);
  if (type === "Point" && points.length !== 1) throw new Error(`Invalid point: ${osmId(element)}`);
  const lons = points.map((p) => p[0]!);
  const lats = points.map((p) => p[1]!);
  return {
    latitude: Number(((Math.min(...lats) + Math.max(...lats)) / 2).toFixed(7)),
    longitude: Number(((Math.min(...lons) + Math.max(...lons)) / 2).toFixed(7)),
    method: type === "Point" ? "osm_point" : "bounding_box_center",
  };
}

function distance(a: Station["location"], b: Station["location"]): number {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** No inferred city, invented translations, synthetic UIC codes or service edges. */
export function transformStations(snapshot: RawSnapshot, mappings: StationMappings) {
  if (!snapshot || !Array.isArray(snapshot.elements) || !snapshot.elements.length ||
    !snapshot.source || snapshot.source.license !== "ODbL-1.0" || !Number.isFinite(Date.parse(snapshot.source.snapshot_at))) {
    throw new Error("Invalid rail source snapshot");
  }
  if (!mappings || !Array.isArray(mappings.merges)) throw new Error("Invalid reviewed station mappings");
  const candidates = new Map<string, { element: RawElement; station: Station }>();
  const excluded: { id: string; reason: string }[] = [];
  const warnings: { id: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const element of snapshot.elements) {
    if (!element || !["node", "way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id) || element.id < 1 ||
      !Number.isSafeInteger(element.version) || element.version < 1 || !element.tags ||
      Object.values(element.tags).some((value) => typeof value !== "string") ||
      !Number.isFinite(Date.parse(element.timestamp)) || Date.parse(element.timestamp) > Date.parse(snapshot.source.snapshot_at)) {
      throw new Error("Invalid OSM station evidence");
    }
    const id = osmId(element);
    if (seen.has(id)) throw new Error(`Duplicate OSM identity: ${id}`);
    seen.add(id);
    const tags = element.tags;
    const classified = classification(tags);
    if (!classified) { excluded.push({ id, reason: "not_station_or_halt" }); continue; }
    if (classified.conflict) warnings.push({ id, reason: classified.conflict });
    if (["tram", "subway", "light_rail", "monorail", "funicular"].includes(tags.station ?? "") ||
      tags.train !== "yes" && ["tram", "subway", "light_rail"].some((key) => tags[key] === "yes")) {
      excluded.push({ id, reason: "urban_or_other_non_train_station" }); continue;
    }
    const location = position(element);
    if (!location) { excluded.push({ id, reason: "missing_geometry" }); continue; }
    const fields = ["type", "location", "osm_status"];
    function field(key: string, ...sourceKeys: string[]): string | null {
      for (const sourceKey of sourceKeys) {
        const value = clean(tags[sourceKey]);
        if (value !== null) { fields.push(key); return value; }
      }
      return null;
    }
    const aliases = [...new Set(["alt_name", "alt_name:ar", "alt_name:fr", "old_name", "short_name", "official_name"]
      .flatMap((key) => (tags[key] ?? "").split(";").map((name) => name.trim()).filter(Boolean)))].sort();
    if (aliases.length) fields.push("aliases");
    const wikidata = clean(tags.wikidata);
    if (wikidata !== null && !/^Q[1-9]\d*$/.test(wikidata)) throw new Error(`Invalid Wikidata ID: ${id}`);
    const station: Station = {
      id, name: field("name", "name"),
      names: { ar: field("names.ar", "name:ar"), fr: field("names.fr", "name:fr"), en: field("names.en", "name:en") },
      aliases, type: classified.type, city: field("city", "addr:city", "is_in:city"),
      operator: field("operator", "operator"), network: field("network", "network"), location,
      osm_status: classified.status, wikidata_id: field("wikidata_id", "wikidata"),
      passenger_service: null, connections: null,
      sources: [{ osm_type: element.type, osm_id: element.id, version: element.version,
        updated_at: element.timestamp, url: `https://www.openstreetmap.org/${element.type}/${element.id}`, fields }],
    };
    candidates.set(id, { element, station });
  }
  const assigned = new Set<string>();
  for (const merge of mappings.merges) {
    if (!merge || typeof merge.primary !== "string" || typeof merge.reason !== "string" || !merge.reason.trim() ||
      !Array.isArray(merge.members) || !merge.members.length || merge.members.some((id) => typeof id !== "string") ||
      merge.members.includes(merge.primary)) throw new Error("Invalid reviewed station merge");
    const primary = candidates.get(merge.primary)?.station;
    if (!primary || assigned.has(merge.primary)) throw new Error(`Missing or reused merge primary: ${merge.primary}`);
    assigned.add(merge.primary);
    for (const id of merge.members) {
      const secondary = candidates.get(id)?.station;
      if (!secondary || assigned.has(id) || primary.type !== secondary.type ||
        primary.osm_status !== secondary.osm_status && secondary.osm_status !== "unknown" ||
        distance(primary.location, secondary.location) > 500 ||
        primary.wikidata_id && secondary.wikidata_id && primary.wikidata_id !== secondary.wikidata_id) {
        throw new Error(`Station merge needs review: ${id}`);
      }
      assigned.add(id);
      const contributed: string[] = [];
      for (const key of ["name", "city", "operator", "network", "wikidata_id"] as const) {
        if (primary[key] === null && secondary[key] !== null) { primary[key] = secondary[key]; contributed.push(key); }
      }
      for (const lang of ["ar", "fr", "en"] as const) {
        if (primary.names[lang] === null && secondary.names[lang] !== null) {
          primary.names[lang] = secondary.names[lang]; contributed.push(`names.${lang}`);
        }
      }
      const aliases = [secondary.name, ...Object.values(secondary.names), ...secondary.aliases].filter((value): value is string => !!value);
      primary.aliases = [...new Set([...primary.aliases, ...aliases])].filter((value) => value !== primary.name).sort();
      if (aliases.length) contributed.push("aliases");
      primary.sources.push({ ...secondary.sources[0]!, fields: contributed.sort() });
      candidates.delete(id);
    }
  }
  const stations = [...candidates.values()].map(({ station }) => station).sort((a, b) => a.id.localeCompare(b.id, "en"));
  return { stations, excluded, warnings, coverage: {
    named: stations.filter((s) => s.name !== null).length,
    name_ar: stations.filter((s) => s.names.ar !== null).length,
    name_fr: stations.filter((s) => s.names.fr !== null).length,
    city: stations.filter((s) => s.city !== null).length,
  } };
}
