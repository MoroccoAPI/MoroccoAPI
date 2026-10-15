import { readFile } from "node:fs/promises";
import { SNAPSHOT_RECORD_COUNT } from "./metadata.js";
import { airportTypes, type Airport } from "./types.js";

const datasetUrl = new URL("../../data/airports/airports.json", import.meta.url);
const types = new Set<string>(airportTypes);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function nullableCode(value: unknown, pattern: RegExp): boolean {
  return value === null || typeof value === "string" && pattern.test(value);
}

export function validateAirports(parsed: unknown): readonly Airport[] {
  if (!Array.isArray(parsed) || parsed.length !== SNAPSHOT_RECORD_COUNT) {
    throw new Error(`The 2026-10-14 MA snapshot must contain ${SNAPSHOT_RECORD_COUNT} airports`);
  }
  const ids = new Set<number>();
  const idents = new Set<string>();
  const icaos = new Set<string>();
  const records = parsed.map((row: unknown, index: number): Airport => {
    if (!isRecord(row) || typeof row.id !== "number" || !Number.isSafeInteger(row.id) || row.id <= 0 ||
      !text(row.ident) || !/^[A-Z0-9][A-Z0-9-]*$/.test(row.ident) ||
      !nullableCode(row.icao_code, /^[A-Z]{4}$/) || !nullableCode(row.iata_code, /^[A-Z]{3}$/) ||
      !text(row.name) || !text(row.type) || !types.has(row.type) ||
      !(row.municipality === null || text(row.municipality)) || row.iso_country !== "MA" ||
      !nullableCode(row.iso_region, /^MA-[A-Z0-9]+(?:-[A-Z0-9]+)*$/) ||
      typeof row.scheduled_service !== "boolean") {
      throw new Error(`Invalid airport record at index ${index}`);
    }
    if (row.location !== null && (!isRecord(row.location) ||
      typeof row.location.latitude !== "number" || !Number.isFinite(row.location.latitude) ||
      Math.abs(row.location.latitude) > 90 || typeof row.location.longitude !== "number" ||
      !Number.isFinite(row.location.longitude) || Math.abs(row.location.longitude) > 180)) {
      throw new Error(`Invalid location for airport '${row.ident}'`);
    }
    const record = row as unknown as Airport;
    if (ids.has(record.id) || idents.has(record.ident) || record.icao_code !== null && icaos.has(record.icao_code)) {
      throw new Error(`Duplicate airport identifier at index ${index}`);
    }
    ids.add(record.id);
    idents.add(record.ident);
    if (record.icao_code !== null) icaos.add(record.icao_code);
    return Object.freeze({
      id: record.id, ident: record.ident, icao_code: record.icao_code, iata_code: record.iata_code,
      name: record.name, type: record.type, municipality: record.municipality,
      iso_country: record.iso_country, iso_region: record.iso_region,
      location: record.location === null ? null : Object.freeze({
        latitude: record.location.latitude, longitude: record.location.longitude,
      }),
      scheduled_service: record.scheduled_service,
    });
  });
  return Object.freeze(records);
}

export async function loadAirports(): Promise<readonly Airport[]> {
  const parsed: unknown = JSON.parse(await readFile(datasetUrl, "utf8"));
  return validateAirports(parsed);
}
