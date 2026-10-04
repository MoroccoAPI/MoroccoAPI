import { readFile } from "node:fs/promises";

import type { Region } from "../types.js";

const datasetUrl = new URL("../../../data/administrative-regions.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRegion(value: unknown, index: number): asserts value is Region {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.hcp_code !== "string" ||
    !/^\d{2}$/.test(value.hcp_code) ||
    value.type !== "region"
  ) {
    throw new Error(`Invalid region record at index ${index}`);
  }

  if (!isRecord(value.name)) {
    throw new Error(`Invalid region name at index ${index}`);
  }

  for (const language of ["ar", "fr", "en"] as const) {
    if (typeof value.name[language] !== "string" || value.name[language].trim() === "") {
      throw new Error(`Missing ${language} region name at index ${index}`);
    }
  }
}

export async function loadRegions(): Promise<readonly Region[]> {
  const raw = await readFile(datasetUrl, "utf8");
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed) || parsed.length !== 12) {
    throw new Error("The administrative regions dataset must contain exactly 12 records");
  }

  parsed.forEach(assertRegion);

  const codes = new Set(parsed.map((region) => region.code));
  if (codes.size !== parsed.length) {
    throw new Error("Administrative region codes must be unique");
  }

  const hcpCodes = new Set(parsed.map((region) => region.hcp_code));
  if (hcpCodes.size !== parsed.length) {
    throw new Error("HCP administrative region codes must be unique");
  }

  if (parsed.some((region) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region.code))) {
    throw new Error("Administrative region codes must be lowercase MoroccoAPI slugs");
  }

  return Object.freeze(
    parsed.map((region) =>
      Object.freeze({ ...region, name: Object.freeze({ ...region.name }) }),
    ),
  );
}
