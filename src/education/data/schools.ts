import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { EducationSchool, SchoolCategory } from "../types.js";

const schoolFiles: readonly { file: string; category: SchoolCategory }[] = [
  { file: "etablissement-prives.json", category: "private-school" },
  { file: "etablissements-prives-cpge.json", category: "private-cpge" },
  { file: "etablissements-publics-primaire.json", category: "public-primary" },
  { file: "etablissements-publics-collegial.json", category: "public-collegial" },
  { file: "etablissement-publics-qualifiant.json", category: "public-qualifying" },
  { file: "etablissements-publics-bts.json", category: "public-bts" },
  { file: "etablissements-publics-cpge.json", category: "public-cpge" },
];

const schoolsDir = new URL("../../../data/education/", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, index: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid education ${field} at record ${index}`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string, index: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") throw new Error(`Invalid education ${field} at record ${index}`);
  const cleaned = value.trim();
  return cleaned === "" || cleaned.toLocaleUpperCase("en") === "NULL" ? null : cleaned;
}

function stableId(prefix: string, value: unknown, occurrences: Map<string, number>): string {
  const digest = createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
  const key = `${prefix}-${digest}`;
  const occurrence = (occurrences.get(key) ?? 0) + 1;
  occurrences.set(key, occurrence);
  return occurrence === 1 ? key : `${key}-${occurrence}`;
}

function assertSchool(value: unknown, index: number): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid education school at record ${index}`);
  for (const key of ["NOM_ETABL", "NOM_ETABA", "LL_COM", "LL_PROV", "LL_REG"]) {
    requiredText(value[key], key, index);
  }
  optionalText(value.AdresseL, "AdresseL", index);
  optionalText(value.AdresseA, "AdresseA", index);
}

export async function loadEducationSchools(): Promise<readonly EducationSchool[]> {
  const schools: EducationSchool[] = [];
  const occurrences = new Map<string, number>();
  for (const { file, category } of schoolFiles) {
    const parsed: unknown = JSON.parse(await readFile(new URL(file, schoolsDir), "utf8"));
    if (!Array.isArray(parsed)) throw new Error(`Education dataset '${file}' must contain an array`);
    parsed.forEach((value: unknown, index: number) => {
      assertSchool(value, index);
      schools.push({
        id: stableId(`school-${category}`, value, occurrences),
        name_fr: requiredText(value.NOM_ETABL, "NOM_ETABL", index),
        name_ar: requiredText(value.NOM_ETABA, "NOM_ETABA", index),
        address_fr: optionalText(value.AdresseL, "AdresseL", index),
        address_ar: optionalText(value.AdresseA, "AdresseA", index),
        commune: requiredText(value.LL_COM, "LL_COM", index),
        province: requiredText(value.LL_PROV, "LL_PROV", index),
        region: requiredText(value.LL_REG, "LL_REG", index),
        category,
        ownership: category.startsWith("private-") ? "private" : "public",
      });
    });
  }
  return Object.freeze(schools.map((school) => Object.freeze(school)));
}
