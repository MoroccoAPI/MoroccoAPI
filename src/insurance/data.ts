import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { intermediaryCategories, type InsuranceData, type InsuranceIntermediary, type InsuranceManifest } from "./types.js";

const baseUrl = new URL("../../data/insurance/", import.meta.url);
const sourceUrl = "https://acaps.ma/fr/l-autorite/decouvrir-l-autorite/secteurs-controles/liste-des-intermediaires-d-assurances";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.trim();
}
function date(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function validateInsuranceData(raw: unknown, manifest: unknown): InsuranceData {
  if (!record(manifest) || manifest.id !== "acaps-insurance-intermediaries" ||
      !text(manifest.title) || !text(manifest.producer) || manifest.source_url !== sourceUrl ||
      manifest.source_license !== null || manifest.terms_url !== "https://acaps.ma/fr/mentions-legales" ||
      manifest.redistribution_status !== "permission-not-obtained" || !date(manifest.retrieved_at) ||
      manifest.source_updated_at !== null || !text(manifest.transformation_version) ||
      !Number.isSafeInteger(manifest.source_record_count) || !Number.isSafeInteger(manifest.record_count) ||
      !Number.isSafeInteger(manifest.captured_source_record_count) || typeof manifest.coverage_complete !== "boolean" ||
      !Array.isArray(manifest.limitations) || manifest.limitations.length === 0 || !manifest.limitations.every(text) ||
      typeof manifest.records_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(manifest.records_sha256)) {
    throw new Error("Invalid insurance source manifest");
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length !== manifest.record_count ||
      (manifest.source_record_count as number) < raw.length ||
      (manifest.captured_source_record_count as number) < raw.length ||
      (manifest.captured_source_record_count as number) > (manifest.source_record_count as number) ||
      (manifest.coverage_complete && manifest.captured_source_record_count !== manifest.source_record_count)) {
    throw new Error("Invalid insurance snapshot size");
  }
  const signatures = new Set<string>();
  const keys = ["acaps_code", "name", "category", "insurer", "city"];
  for (const item of raw) {
    if (!record(item) || Object.keys(item).length !== keys.length || Object.keys(item).some((key) => !keys.includes(key)) ||
        typeof item.acaps_code !== "string" || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(item.acaps_code) ||
        item.acaps_code.length > 64 || !(item.name === null || text(item.name)) ||
        !intermediaryCategories.some((category) => category === item.category) ||
        !(item.insurer === null || text(item.insurer)) || !(item.city === null || text(item.city))) {
      throw new Error("Invalid or duplicate insurance intermediary");
    }
    const signature = JSON.stringify(keys.map((key) => item[key]));
    if (signatures.has(signature)) throw new Error("Duplicate insurance intermediary record");
    signatures.add(signature);
  }
  return freeze({
    intermediaries: structuredClone(raw) as InsuranceIntermediary[],
    manifest: structuredClone(manifest) as unknown as InsuranceManifest,
  });
}

export async function loadInsuranceIntermediaries(): Promise<InsuranceData> {
  const [contents, metadata] = await Promise.all([
    readFile(new URL("intermediaries.json", baseUrl), "utf8"),
    readFile(new URL("sources.json", baseUrl), "utf8"),
  ]);
  const snapshot = validateInsuranceData(JSON.parse(contents), JSON.parse(metadata));
  if (createHash("sha256").update(contents).digest("hex") !== snapshot.manifest.records_sha256) {
    throw new Error("Insurance snapshot checksum mismatch");
  }
  return snapshot;
}
