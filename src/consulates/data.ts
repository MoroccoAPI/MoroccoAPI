import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { isSupportedCountry } from "libphonenumber-js/max";

import type { Consulate, ConsulateData, ConsulateManifest } from "./types.js";

const baseUrl = new URL("../../data/consulates/", import.meta.url);
const sourceUrl = "https://diplomatie.ma/fr/annuaire";
const termsUrl = "https://diplomatie.ma/fr/mentions-l%C3%A9gales";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}
function webUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function validateConsulateData(raw: unknown, manifest: unknown): ConsulateData {
  if (!record(manifest) || manifest.id !== "moroccan-consulates" ||
      !text(manifest.title) || !text(manifest.producer) || manifest.source_url !== sourceUrl ||
      manifest.source_license !== null || manifest.terms_url !== termsUrl ||
      manifest.redistribution_status !== "permission-not-obtained" ||
      typeof manifest.retrieved_at !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.retrieved_at) ||
      !Number.isFinite(Date.parse(manifest.retrieved_at)) ||
      new Date(manifest.retrieved_at).toISOString().slice(0, 10) !== manifest.retrieved_at ||
      manifest.source_updated_at !== null || !text(manifest.transformation_version) ||
      !Number.isInteger(manifest.record_count) || !Number.isInteger(manifest.raw_record_count) ||
      !Number.isInteger(manifest.countries) || !strings(manifest.limitations) ||
      typeof manifest.raw_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.raw_sha256) ||
      typeof manifest.records_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.records_sha256)) {
    throw new Error("Invalid consulate source manifest");
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length !== manifest.record_count ||
      (manifest.raw_record_count as number) < raw.length) {
    throw new Error("Invalid consulate snapshot size");
  }
  const ids = new Set<string>();
  const countries = new Set<string>();
  const keys = ["id", "name", "country", "city", "address", "phones", "website", "source_names", "quality_flags"];
  for (const item of raw) {
    if (!record(item) || Object.keys(item).some((key) => !keys.includes(key)) ||
        typeof item.id !== "string" || !/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) || ids.has(item.id) ||
        !record(item.name) || !text(item.name.fr) || Object.keys(item.name).length !== 1 ||
        !record(item.country) || typeof item.country.code !== "string" ||
        !isSupportedCountry(item.country.code) || !text(item.country.name) || Object.keys(item.country).length !== 2 ||
        !item.id.startsWith(`${item.country.code.toLowerCase()}-`) || !text(item.city) ||
        !(item.address === null || text(item.address)) || !Array.isArray(item.phones) ||
        !item.phones.every((phone) => record(phone) && Object.keys(phone).length === 2 && text(phone.raw) &&
          (phone.e164 === null || (typeof phone.e164 === "string" && /^\+[1-9][0-9]{6,14}$/.test(phone.e164)))) ||
        !(item.website === null || webUrl(item.website)) ||
        !strings(item.source_names) || item.source_names.length === 0 || !strings(item.quality_flags)) {
      throw new Error("Invalid or duplicate consulate record");
    }
    ids.add(item.id);
    countries.add(item.country.code);
  }
  if (countries.size !== manifest.countries) throw new Error("Invalid consulate country count");
  return freeze({
    consulates: structuredClone(raw) as Consulate[],
    manifest: structuredClone(manifest) as unknown as ConsulateManifest,
  });
}

export async function loadConsulates(): Promise<ConsulateData> {
  const [contents, metadata] = await Promise.all([
    readFile(new URL("consulates.json", baseUrl), "utf8"),
    readFile(new URL("sources.json", baseUrl), "utf8"),
  ]);
  const snapshot = validateConsulateData(JSON.parse(contents), JSON.parse(metadata));
  if (createHash("sha256").update(contents).digest("hex") !== snapshot.manifest.records_sha256) {
    throw new Error("Consulate snapshot checksum mismatch");
  }
  return snapshot;
}
