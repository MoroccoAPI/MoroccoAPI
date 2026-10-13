import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkDate, countBusinessDays, getCalendar, parseDate } from "../../src/holidays/calendar.js";
import { confirmations, fixedRules, MAX_YEAR, MIN_YEAR, religiousRules } from "../../src/holidays/data.js";

describe("Calendar source integrity", () => {
  it("contains unique legal rules, real confirmations and complete translations", () => {
    assert.equal(new Set([...fixedRules, ...religiousRules].map((rule) => rule.id)).size, 15);
    assert.equal(new Set(confirmations.map((row) => `${row.holiday_id}:${row.date}`)).size, confirmations.length);
    for (const rule of [...fixedRules, ...religiousRules]) {
      for (const name of Object.values(rule.names)) assert.ok(name.trim().length > 0);
    }
    for (const row of confirmations) {
      assert.ok(religiousRules.some((rule) => rule.id === row.holiday_id));
      assert.notEqual(parseDate(row.date), null);
      assert.equal(new URL(row.source_url).hostname.replace(/^www\./, ""), "habous.gov.ma");
      if (row.source_updated_at !== null) assert.ok(row.source_updated_at <= row.date);
    }
    for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
      const calendar = getCalendar(year);
      for (const row of calendar.holidays) {
        if (row.date) {
          assert.equal(Number(row.date.slice(0, 4)), year);
          assert.notEqual(parseDate(row.date), null);
        }
      }
    }
  });

  it("rejects normalized invalid civil dates and unsupported function inputs", () => {
    for (const value of ["2026-02-29", "2026-04-31", "2026-00-01", "2026-01-32", "2026-1-1", "2026-01-01T00:00:00+01:00"]) assert.equal(parseDate(value), null);
    assert.notEqual(parseDate("2024-02-29"), null);
    assert.equal(parseDate("2026-01-01"), Date.UTC(2026, 0, 1));
    assert.throws(() => getCalendar(2026.5), RangeError);
    assert.throws(() => getCalendar(2030), RangeError);
    assert.throws(() => checkDate("2025-01-01", getCalendar(2026)), RangeError);
  });

  it("counts overlapping holidays once and does not mutate the calendar", () => {
    const calendar = getCalendar(2026);
    const original = JSON.stringify(calendar);
    const overlap = { ...calendar, holidays: [...calendar.holidays, { ...calendar.holidays[0]!, id: "additional-closure" }] };
    const result = countBusinessDays("2026-01-01", "2026-01-02", [overlap]);
    assert.equal(result.holiday_weekdays, 1);
    assert.equal(result.business_days, 1);
    assert.equal(JSON.stringify(calendar), original);
    assert.throws(() => countBusinessDays("2026-01-01", "2026-01-02", []), RangeError);
  });
});
