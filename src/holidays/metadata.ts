import { confirmations, HOLIDAY_DECREE, LEGAL_BASIS, LICENSE_URL, REVIEWED_AT, UNITY_DECREE, WORK_DECREE } from "./data.js";
import type { Calendar } from "./types.js";

export function buildCalendarMeta(calendars: readonly Calendar[], total: number) {
  const years = calendars.map((calendar) => calendar.year);
  return {
    dataset: "moroccan-public-holidays", total, license: LEGAL_BASIS, license_url: LICENSE_URL,
    reviewed_at: REVIEWED_AT, transformation_version: "1.0.0",
    scope: "public-administration-common-calendar", weekend_days: ["Saturday", "Sunday"], years,
    calendar_complete: calendars.every((calendar) => calendar.complete),
    pending_holiday_days: calendars.reduce((sum, calendar) => sum + calendar.holidays.filter((row) => row.date === null).length, 0),
    sources: [
      { producer: "Ministry of Digital Transition and Administrative Reform", source_url: HOLIDAY_DECREE, source_updated_at: null },
      { producer: "General Secretariat of the Government", source_url: UNITY_DECREE, source_updated_at: "2026-02-05" },
      { producer: "Ministry of Digital Transition and Administrative Reform", source_url: WORK_DECREE, source_updated_at: "2018-11-09" },
      ...confirmations.filter((row) => years.includes(Number(row.date.slice(0, 4)))).map((row) => ({
        producer: "Ministry of Habous and Islamic Affairs", source_url: row.source_url, source_updated_at: row.source_updated_at,
      })),
    ],
    limitations: [
      "Common public-administration calendar; excludes employee-specific religious observances, exceptional closures and sector-specific work schedules.",
      "Religious Gregorian dates are published only after official confirmation; missing dates remain null.",
      "Future fixed dates apply rules reviewed on 2026-10-13 and may change. No substitute weekday is assumed for weekend holidays.",
      "Arabic and French holiday labels are normalized; English labels are MoroccoAPI translations.",
    ],
  };
}
