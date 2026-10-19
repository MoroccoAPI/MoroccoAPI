import { readFile } from "node:fs/promises";

import type { GradeSalary } from "../types.js";

const salariesDatasetURL = new URL("../../../data/public-service/salaries.json", import.meta.url);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertGradeSalary(value: unknown): asserts value is GradeSalary {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.code) || !/^[a-z0-9-]+$/.test(value.code) ||
    !isRecord(value.grade) || !isNonEmptyString(value.grade.fr) ||
    !isRecord(value.corps) || !isNonEmptyString(value.corps.ar) ||
    !Number.isSafeInteger(value.net_monthly_salary_mad) || (value.net_monthly_salary_mad as number) <= 0 ||
    !isNonEmptyString(value.reference_url) || !value.reference_url.startsWith("https://")
  ) {
    throw new Error("Invalid public-service salary record");
  }
}

export async function loadGradeSalaries(): Promise<readonly GradeSalary[]> {
  const raw = await readFile(salariesDatasetURL, "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("The public-service salary dataset must be a non-empty array");
  }
  const codes = new Set<string>();
  const records = parsed.map((record: unknown) => {
    assertGradeSalary(record);
    if (codes.has(record.code)) {
      throw new Error(`Duplicate public-service salary code '${record.code}'`);
    }
    codes.add(record.code);
    return Object.freeze({
      ...record,
      grade: Object.freeze({ ...record.grade }),
      corps: Object.freeze({ ...record.corps }),
    });
  });
  return Object.freeze(records);
}
