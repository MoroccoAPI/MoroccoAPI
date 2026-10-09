import { parsePhoneNumberFromString } from "libphonenumber-js/max";

import type { NumberLookup, NumberValidation, TelecomData } from "./types.js";

function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹０-９]/g, (character) => {
    const code = character.charCodeAt(0);
    const zero = code >= 0xff10 ? 0xff10 : code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - zero);
  });
}

function invalid(reason: NumberValidation["reason"]): NumberValidation {
  return {
    is_possible: false,
    is_valid_format: false,
    is_allocated_range: null,
    has_known_prefix: false,
    e164: null,
    national_number: null,
    number_type: null,
    reason,
  };
}

export function findPrefix<T extends { prefix: string }>(number: string, rows: readonly T[]): T | undefined {
  let match: T | undefined;
  for (const row of rows) {
    if (number.startsWith(row.prefix) && (!match || row.prefix.length > match.prefix.length)) {
      match = row;
    }
  }
  return match;
}

export function validateNumber(input: string, data: TelecomData): NumberValidation {
  const normalized = normalizeDigits(input.trim());
  if (!/^\+?[0-9 ().-]+$/.test(normalized)) {
    return invalid("INVALID_CHARACTERS");
  }
  const digits = normalized.replace(/[ ().-]/g, "");
  let significant: string;
  if (digits.startsWith("+") || digits.startsWith("00")) {
    const international = digits.startsWith("+") ? digits.slice(1) : digits.slice(2);
    if (!international.startsWith("212")) {
      return invalid("NOT_MOROCCAN");
    }
    significant = international.slice(3);
  } else {
    significant = digits.startsWith("0") ? digits.slice(1) : digits;
  }
  if (significant.length !== 9) {
    return invalid("INVALID_LENGTH");
  }
  const phone = parsePhoneNumberFromString(`+212${significant}`, { extract: false });
  if (!phone) {
    return invalid("INVALID_NUMBER_PATTERN");
  }
  const national = `0${significant}`;
  const valid = phone.isValid();
  return {
    is_possible: phone.isPossible(),
    is_valid_format: valid,
    is_allocated_range: null,
    has_known_prefix: findPrefix(national, data.ranges) !== undefined,
    e164: phone.number,
    national_number: national,
    number_type: phone.getType()?.toLowerCase() ?? null,
    reason: valid ? null : "INVALID_NUMBER_PATTERN",
  };
}

export function lookupNumber(input: string, data: TelecomData): NumberLookup {
  const result = validateNumber(input, data);
  const match = result.is_valid_format && result.national_number !== null
    ? findPrefix(result.national_number, data.ranges) : undefined;
  return {
    ...result,
    matched_prefix: match?.prefix ?? null,
    original_operator: match?.original_operator ?? null,
    current_operator: null,
    geographic_area: data.areas.find((area) => area.code === match?.area_code) ?? null,
  };
}
