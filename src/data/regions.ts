import { readFile } from "node:fs/promises";

import type { DatasetMeta, Region } from "../types.js";

const datasetUrl = new URL("../../data/administrative-regions.json", import.meta.url);

export const regionSources = [
  {
    dataset: "Répartition du personnel des administrations publiques selon les régions",
    producer: "Ministère de la Transition Numérique et de la Réforme de l’Administration (MTNRA)",
    source_url:
      "https://data.gov.ma/data/fr/dataset/repartition-du-personnel-des-administrations-publiques-selon-les-regions",
    resource_url:
      "https://data.gov.ma/data/fr/dataset/5995a4d8-0a8a-4a29-9ba3-8ffd6264cb2f/resource/07555a6f-c648-4938-837d-46ce51908b8f/download/repartition-du-personnel-des-administrations-publiques-selon-les-regions.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2025-11-25",
  },
  {
    dataset: "Unités d'habitat achevées par région et par catégorie 2016-2023",
    producer:
      "Ministère de l’Aménagement du Territoire National, de l’Urbanisme, de l’Habitat et de la Politique de la Ville (MATNUHPV)",
    source_url:
      "https://data.gov.ma/data/fr/dataset/unites-d-habitat-achevees-par-region-et-par-categorie-2016-2020",
    resource_url:
      "https://data.gov.ma/data/fr/dataset/9a92d8bd-34c9-4ce7-9995-b9acbd83e671/resource/00fabe8e-0675-4779-9417-3bc6e721677a/download/unites-dhabitat-achevees-par-region-et-par-categorie-2016-2023.xlsx",
    license: "ODbL-1.0",
    source_updated_at: "2024-10-30",
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRegion(value: unknown, index: number): asserts value is Region {
  if (!isRecord(value) || typeof value.code !== "string" || value.type !== "region") {
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
    license: "ODbL-1.0",
    retrieved_at: "2026-09-21",
    transformation_version: "1.0.0",
    sources: regionSources,
  };
}
