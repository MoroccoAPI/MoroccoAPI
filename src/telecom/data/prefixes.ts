import { readFile } from "node:fs/promises";

import type { AreaCode, NumberingRange, TelecomData } from "../types.js";

const prefixPattern = /^0[5-7]\d{1,3}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertArea(value: unknown): asserts value is AreaCode {
  if (!isRecord(value) || typeof value.code !== "string" || !/^05\d{1,3}$/.test(value.code) ||
    value.international_prefix !== `+212${value.code.slice(1)}` || value.hcp_code !== null ||
    !isRecord(value.description) || value.description.ar !== null ||
    !isRecord(value.areas) || value.areas.ar !== null) {
    throw new Error("Invalid telecom area code");
  }
  for (const language of ["fr", "en"] as const) {
    const description = value.description[language];
    const areas = value.areas[language];
    if (typeof description !== "string" || description.trim() === "" ||
      !Array.isArray(areas) || JSON.stringify(areas) !== JSON.stringify(description.split("/"))) {
      throw new Error("Invalid telecom geographic descriptions");
    }
  }
}

function assertRange(value: unknown): asserts value is NumberingRange {
  if (!isRecord(value) || typeof value.prefix !== "string" || !prefixPattern.test(value.prefix) ||
    value.international_prefix !== `+212${value.prefix.slice(1)}` ||
    value.mask !== value.prefix + "X".repeat(10 - value.prefix.length) ||
    !Array.isArray(value.more_specific_prefixes) ||
    value.more_specific_prefixes.some((prefix) => typeof prefix !== "string")) {
    throw new Error("Invalid telecom prefix mapping");
  }
  if (value.category === "carrier") {
    if (!/^0[67]/.test(value.prefix) || value.area_code !== null ||
      !isRecord(value.original_operator) ||
      typeof value.original_operator.code !== "string" ||
      !/^[a-z]+(?:-[a-z]+)*$/.test(value.original_operator.code) ||
      typeof value.original_operator.name !== "string" || value.original_operator.name.trim() === "") {
      throw new Error("Invalid telecom carrier mapping");
    }
  } else if (value.category === "geographic") {
    if (value.area_code !== value.prefix || value.original_operator !== null) {
      throw new Error("Invalid telecom geographic mapping");
    }
  } else {
    throw new Error("Invalid telecom mapping category");
  }
}

export function validateTelecomData(rawRanges: unknown, rawAreas: unknown): TelecomData {
  if (!Array.isArray(rawRanges) || rawRanges.length !== 156 ||
    !Array.isArray(rawAreas) || rawAreas.length !== 77) {
    throw new Error("Telecom snapshot must contain 156 mappings and 77 area descriptions");
  }
  rawRanges.forEach(assertRange);
  rawAreas.forEach(assertArea);
  const ranges = rawRanges as NumberingRange[];
  const areas = rawAreas as AreaCode[];
  if (new Set(ranges.map((row) => row.prefix)).size !== ranges.length ||
    new Set(areas.map((row) => row.code)).size !== areas.length) {
    throw new Error("Telecom prefixes must be unique");
  }
  if (ranges.filter((row) => row.category === "carrier").length !== 79) {
    throw new Error("Telecom snapshot must contain 79 carrier mappings");
  }
  const areaCodes = new Set(areas.map((row) => row.code));
  for (const row of ranges) {
    if (row.category === "geographic" && !areaCodes.has(row.prefix)) {
      throw new Error("Unknown telecom area code");
    }
    const children = ranges.filter((child) => child.prefix !== row.prefix && child.prefix.startsWith(row.prefix))
      .map((child) => child.prefix).sort();
    if (JSON.stringify([...row.more_specific_prefixes].sort()) !== JSON.stringify(children)) {
      throw new Error("Invalid telecom prefix overrides");
    }
  }
  return Object.freeze({
    ranges: Object.freeze(ranges.map((row) => Object.freeze({
      ...row,
      original_operator: row.original_operator === null ? null : Object.freeze({ ...row.original_operator }),
      more_specific_prefixes: Object.freeze([...row.more_specific_prefixes]),
    }))),
    areas: Object.freeze(areas.map((row) => Object.freeze({
      ...row,
      description: Object.freeze({ ...row.description }),
      areas: Object.freeze({ ar: null, fr: Object.freeze([...row.areas.fr]), en: Object.freeze([...row.areas.en]) }),
    }))),
  });
}

export async function loadTelecom(): Promise<TelecomData> {
  const [ranges, areas] = await Promise.all([
    readFile(new URL("../../../data/telecom/numbering-ranges.json", import.meta.url), "utf8"),
    readFile(new URL("../../../data/telecom/area-codes.json", import.meta.url), "utf8"),
  ]);
  return validateTelecomData(JSON.parse(ranges), JSON.parse(areas));
}
