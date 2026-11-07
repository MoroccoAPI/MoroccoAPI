import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { BankingManifest, BankingSnapshot } from "./types.js";

const base = new URL("../../data/banking/", import.meta.url);
const termsUrl = "https://www.bkam.ma/content/download/800609/8840920/version/1/file/Charte+de+diffusion_19+02+2024.pdf";
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const slug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 200;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export function validateBankingData(raw: unknown, manifest: unknown): { data: BankingSnapshot; manifest: BankingManifest } {
  if (!isRecord(manifest) || manifest.dataset !== "bam-banking" || manifest.producer !== "Bank Al-Maghrib" ||
    manifest.license !== "LicenseRef-BAM-Charte-Diffusion" || manifest.terms_url !== termsUrl ||
    !text(manifest.terms_section) || !date(manifest.received_at) || !date(manifest.copied_at) ||
    manifest.copied_at < manifest.received_at || !text(manifest.transformation_version) || !hash(manifest.snapshot_sha256) ||
    !text(manifest.attribution) || !manifest.attribution.includes(manifest.copied_at) || !text(manifest.notice) ||
    !isRecord(manifest.reuse) || manifest.reuse.non_commercial_use !== "permitted-with-attribution-and-copy-date" ||
    manifest.reuse.commercial_use !== "written-permission-required" || manifest.reuse.modifications !== "disclose-changes-and-BAM-non-liability" ||
    !Array.isArray(manifest.limitations) || !manifest.limitations.length || !manifest.limitations.every(text) ||
    !Array.isArray(manifest.sources) || manifest.sources.length !== 2) {
    throw new Error("Invalid BAM source manifest");
  }
  const sourceDefinitions = [
    { dataset: "institutions", sheet: "Annexes 2 ", reference_date: null, date_basis: "not-stated-in-workbook" },
    { dataset: "bank-codes", sheet: "Feuil1", reference_date: "2026-11-03", date_basis: "source-filename" },
  ];
  const sourceKeys = ["dataset", "filename", "sheet", "records", "reference_date", "date_basis", "sha256"];
  for (const [index, definition] of sourceDefinitions.entries()) {
    const source = manifest.sources[index];
    if (!isRecord(source) || Object.keys(source).length !== sourceKeys.length ||
      Object.keys(source).some(key => !sourceKeys.includes(key)) ||
      Object.entries(definition).some(([key, value]) => source[key] !== value) ||
      !text(source.filename) || !hash(source.sha256) || !count(source.records)) throw new Error("Invalid BAM source reference");
  }
  if (!isRecord(raw) || Object.keys(raw).sort().join("|") !== "bank_codes|categories|institutions" ||
    !Array.isArray(raw.institutions) || !Array.isArray(raw.bank_codes) || !Array.isArray(raw.categories)) {
    throw new Error("Invalid BAM snapshot");
  }
  const categoryMap = new Map<string, { name: string; count: number }>();
  for (const category of raw.categories) {
    if (!isRecord(category) || !["institutions", "bank-codes"].includes(String(category.dataset)) ||
      !slug(category.code) || !text(category.name) || !count(category.count)) throw new Error("Invalid BAM category");
    const key = `${category.dataset}|${category.code}`;
    if (categoryMap.has(key)) throw new Error("Duplicate BAM category");
    categoryMap.set(key, { name: category.name, count: category.count });
  }
  const actualCounts = new Map<string, number>();
  for (const [index, records] of [raw.institutions, raw.bank_codes].entries()) {
    const source = manifest.sources[index] as Record<string, unknown>;
    if (!records.length || records.length !== source.records) throw new Error("BAM record count mismatch");
    const identifiers = new Set<string>();
    let lastRow = 0;
    for (const item of records) {
      if (!isRecord(item) || !text(item.name) || !slug(item.category_code) || !text(item.category_name) ||
        !isRecord(item.source_ref) || item.source_ref.sheet !== source.sheet || !count(item.source_ref.row) ||
        item.source_ref.row <= lastRow || Object.keys(item.source_ref).length !== 2 ||
        Object.keys(item).length !== (index === 0 ? 6 : 5)) throw new Error("Invalid BAM record");
      lastRow = item.source_ref.row;
      const identifier = index === 0 ? item.id : item.code;
      if (index === 0 ? !slug(identifier) || !text(item.head_office_address) :
        typeof identifier !== "string" || !/^[0-9]{3}$/.test(identifier)) throw new Error("Invalid BAM identifier or address");
      if (identifiers.has(identifier as string)) throw new Error("Duplicate BAM identifier");
      identifiers.add(identifier as string);
      const key = `${source.dataset}|${item.category_code}`;
      if (categoryMap.get(key)?.name !== item.category_name) throw new Error("Unmapped BAM category");
      actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
    }
  }
  for (const [key, category] of categoryMap) {
    if (actualCounts.get(key) !== category.count) throw new Error("BAM category count mismatch");
  }
  return freeze({ data: structuredClone(raw) as unknown as BankingSnapshot, manifest: structuredClone(manifest) as unknown as BankingManifest });
}

export async function loadBankingData() {
  const [contents, metadata] = await Promise.all([
    readFile(new URL("snapshot.json", base), "utf8"), readFile(new URL("manifest.json", base), "utf8"),
  ]);
  const snapshot = validateBankingData(JSON.parse(contents), JSON.parse(metadata));
  if (digest(contents) !== snapshot.manifest.snapshot_sha256) throw new Error("BAM snapshot checksum mismatch");
  return snapshot;
}
