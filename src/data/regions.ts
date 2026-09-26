import { readFile } from "node:fs/promises";

import type { DatasetMeta, Region } from "../types.js";

const datasetUrl = new URL("../../data/administrative-regions.json", import.meta.url);

export const regionSources = [
  {
    dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
    producer: "Haut-Commissariat au Plan (HCP)",
    source_url:
      "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
    resource_url: "https://www.hcp.ma/file/242341/",
    license: "CC-BY-4.0",
    source_updated_at: "2024-11-22",
  },
] as const;

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

export function buildDatasetMeta(total: number): DatasetMeta {
  return {
    dataset: "administrative-regions",
    total,
    license: "CC-BY-4.0",
    retrieved_at: "2026-09-25",
    transformation_version: "2.0.0",
    sources: regionSources,
  };
}
