import { readFile } from "node:fs/promises";

import { WDI_LAST_UPDATED } from "../metadata.js";
import type { WorldBankData } from "../types.js";
import { assertSourceMetadata, buildWorldBankSnapshot, type WorldBankMappings } from "./transform.js";

const dataUrl = new URL("../../../data/world-bank/", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertWorldBankMappings(value: unknown): asserts value is WorldBankMappings {
  const sections = ["allowed_licenses", "excluded_indicators"];
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== sections.join("|") ||
    sections.some((section) => {
      const entries = (value[section] as Record<string, unknown> | undefined)?.entries;
      return !isRecord(value[section]) || !Array.isArray(entries) || !entries.every(isRecord);
    })) {
    throw new Error("Invalid World Bank mapping file");
  }
}

export async function loadWorldBank(): Promise<WorldBankData> {
  const read = (name: string) => readFile(new URL(name, dataUrl), "utf8");
  const [csv, rawMetadata, rawMappings] = await Promise.all([
    read("source/API_MAR_DS2_en_csv_v2.csv"), read("source/indicator-metadata.json"), read("mappings.json"),
  ]);
  const metadata: unknown = JSON.parse(rawMetadata);
  const mappings: unknown = JSON.parse(rawMappings);
  assertSourceMetadata(metadata);
  assertWorldBankMappings(mappings);
  const snapshot = buildWorldBankSnapshot(csv, metadata, mappings);
  if (snapshot.lastUpdated !== WDI_LAST_UPDATED) {
    throw new Error(`World Bank CSV is dated ${snapshot.lastUpdated}; update WDI_LAST_UPDATED and the source manifest`);
  }
  return Object.freeze({
    indicators: Object.freeze(snapshot.indicators.map((indicator) => Object.freeze({
      ...indicator,
      values: Object.freeze(indicator.values.map((value) => Object.freeze({ ...value }))),
    }))),
    topics: Object.freeze(snapshot.topics.map((topic) => Object.freeze({ ...topic }))),
    excluded: Object.freeze(snapshot.excluded.map((entry) => Object.freeze({ ...entry }))),
  });
}
