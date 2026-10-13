import { confirmations, fixedRules, MAX_YEAR, MIN_YEAR, religiousRules, HOLIDAY_DECREE, UNITY_DECREE } from "./data.js";
import type { Calendar, Holiday } from "./types.js";

const DAY_MS = 86_400_000;

/** ISO civil dates, never instants or the host's local timezone. */
export function parseDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function supportsDate(value: string): boolean {
  return parseDate(value) !== null && Number(value.slice(0, 4)) >= MIN_YEAR && Number(value.slice(0, 4)) <= MAX_YEAR;
}

export function getCalendar(year: number): Calendar {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) throw new RangeError("Unsupported calendar year");
  const holidays: Holiday[] = fixedRules.filter((rule) => year >= rule.first_year).map((rule) => ({
    id: rule.id, date: `${year}-${rule.month_day}`, names: rule.names,
    type: "national", status: "fixed", day: 1,
    source_urls: rule.id === "unity-day" ? [HOLIDAY_DECREE, UNITY_DECREE] : [HOLIDAY_DECREE],
  }));
  let complete = true;
  for (const rule of religiousRules) {
    const matches = confirmations.filter((row) => row.holiday_id === rule.id && Number(row.date.slice(0, 4)) === year);
    // More than one occurrence in a Gregorian year is supported.
    if (!matches.length) complete = false;
    for (const confirmation of matches.length ? matches : [null]) {
      for (let day = 1; day <= rule.days; day++) {
        const date = confirmation ? new Date(parseDate(confirmation.date)! + (day - 1) * DAY_MS).toISOString().slice(0, 10) : null;
        if (date !== null && Number(date.slice(0, 4)) !== year) continue;
        holidays.push({
          id: rule.id, date, names: rule.names, type: "religious",
          status: confirmation ? "confirmed" : "pending_confirmation", day,
          source_urls: confirmation ? [HOLIDAY_DECREE, confirmation.source_url] : [HOLIDAY_DECREE],
        });
      }
    }
  }
  holidays.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.id.localeCompare(b.id) || a.day - b.day);
  return { year, holidays, complete };
}

export function checkDate(date: string, calendar: Calendar) {
  const timestamp = parseDate(date);
  if (timestamp === null || Number(date.slice(0, 4)) !== calendar.year) throw new RangeError("Invalid calendar date");
  const weekday = new Date(timestamp).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const holidays = calendar.holidays.filter((holiday) => holiday.date === date);
  const isHoliday = holidays.length > 0 ? true : calendar.complete ? false : null;
  return {
    date, is_weekend: isWeekend, is_holiday: isHoliday,
    is_business_day: isWeekend || isHoliday === true ? false : isHoliday === false ? true : null,
    holidays,
  };
}

export function countBusinessDays(from: string, to: string, calendars: readonly Calendar[]) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (start === null || end === null || end < start || (end - start) / DAY_MS + 1 > 366) throw new RangeError("Invalid date range");
  const byYear = new Map(calendars.map((calendar) => [calendar.year, calendar]));
  let weekendDays = 0;
  let holidayWeekdays = 0;
  let complete = true;
  for (let time = start; time <= end; time += DAY_MS) {
    const date = new Date(time).toISOString().slice(0, 10);
    const calendar = byYear.get(Number(date.slice(0, 4)));
    if (!calendar) throw new RangeError("Missing calendar year");
    const checked = checkDate(date, calendar);
    if (checked.is_weekend) weekendDays++;
    else if (checked.is_holiday === true) holidayWeekdays++;
    else if (checked.is_holiday === null) complete = false;
  }
  const calendarDays = (end - start) / DAY_MS + 1;
  const upperBound = calendarDays - weekendDays - holidayWeekdays;
  return {
    from, to, inclusive: true, calendar_days: calendarDays, weekend_days: weekendDays,
    holiday_weekdays: holidayWeekdays, business_days: complete ? upperBound : null,
    business_days_upper_bound: upperBound, is_exact: complete,
  };
}
