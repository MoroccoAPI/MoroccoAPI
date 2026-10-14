import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { UniversityEstablishment } from "../types.js";

const universitiesFile = new URL("../../../data/education/universites-publiques.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, index: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid university ${field} at record ${index}`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, index: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") throw new Error(`Invalid university ${field} at record ${index}`);
  const cleaned = value.trim();
  return cleaned === "" ? null : cleaned;
}

function stableId(value: unknown, occurrences: Map<string, number>): string {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
  const key = `university-${digest}`;
  const occurrence = (occurrences.get(key) ?? 0) + 1;
  occurrences.set(key, occurrence);
  return occurrence === 1 ? key : `${key}-${occurrence}`;
}

export async function loadUniversityEstablishments(): Promise<readonly UniversityEstablishment[]> {
  const parsed: unknown = JSON.parse(await readFile(universitiesFile, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("Public university dataset must contain an array");
  const occurrences = new Map<string, number>();
  const universities = parsed.map((value: unknown, index: number): UniversityEstablishment => {
    if (!isRecord(value)) throw new Error(`Invalid university establishment at record ${index}`);
    const enrollment = value.EFFECTIFS_2023_2024;
    if (enrollment !== null && enrollment !== undefined && (!Number.isSafeInteger(enrollment) || (enrollment as number) < 0)) {
      throw new Error(`Invalid university enrollment at record ${index}`);
    }
    return {
      id: stableId(value, occurrences),
      university_fr: requiredText(value.UNIVERSITE, "UNIVERSITE", index),
      university_ar: requiredText(value.UNIVERSITE_AR, "UNIVERSITE_AR", index),
      establishment_fr: requiredText(value.ETABLISSEMENT, "ETABLISSEMENT", index),
      establishment_ar: requiredText(value.ETABLISSEMENT_AR, "ETABLISSEMENT_AR", index),
      abbreviation: requiredText(value.ETABLISSEMENT_ABR, "ETABLISSEMENT_ABR", index),
      city: requiredText(value.VILLE, "VILLE", index),
      address: optionalText(value.ADRESSE, "ADRESSE", index),
      enrollment_2023_2024: typeof enrollment === "number" ? enrollment : null,
      telephone: optionalText(value.TELEPHONE, "TELEPHONE", index),
      fax: optionalText(value.FAX, "FAX", index),
    };
  });
  return Object.freeze(universities.map((university) => Object.freeze(university)));
}
