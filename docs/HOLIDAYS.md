# Public holidays and business days

The holidays domain implements [issue #24](https://github.com/MoroccoAPI/MoroccoAPI/issues/24).
It exposes the common public-administration calendar for **2024–2027**.
Religious dates have been reviewed for **2026 only**. Historical dates for
2024–2025 and future religious dates for 2027 remain explicitly unknown.

| Request | Behavior |
| --- | --- |
| `GET /api/v1/holidays/2026?lang=ar` | One record per holiday day, sorted by date; undated records last |
| `GET /api/v1/holidays/check?date=2026-05-28&lang=fr` | Holiday matches, weekend status and business-day status |
| `GET /api/v1/business-days?from=2026-03-19&to=2026-03-23` | Inclusive range: two business days |

`lang` accepts `ar`, `fr` or `en` and defaults to English. Every holiday retains
all three `names`, a stable event `id`, a selected `name`, a `day` (1 or 2),
`source_urls` and a `status`:

- `fixed`: Gregorian date prescribed by the legal rules reviewed for this snapshot.
- `confirmed`: Gregorian religious date established by an official announcement.
- `pending_confirmation`: `date: null`; no estimated Gregorian date is supplied.

The annual endpoint includes 18 dated records in 2026: 11 fixed dates and seven
religious holiday days. Unity Day is included from 2026. Eid al-Fitr, Eid al-Adha
and Mawlid each occupy two consecutive days; Islamic New Year occupies one day.
Arabic/French labels are normalized; English labels are project translations.

## Date checks and incomplete calendars

Dates must be real Gregorian civil dates in exactly `YYYY-MM-DD` format.
Timestamps, offsets, impossible dates and dates outside the supported years
return HTTP 400 with the shared error envelope. A leap-year February 29 is valid.

`is_holiday` is `true` for a known holiday. On other dates it is `false` only when
the year's common religious calendar is complete; otherwise it is `null`.
`is_business_day` is `false` on a known holiday or a weekend, `true` on a known
ordinary weekday and `null` when an unconfirmed holiday could affect a weekday.
Saturday and Sunday remain non-business days even in an incomplete calendar.

## Business-day counts

Both `from` and `to` are included. The maximum range is 366 civil days and
cross-year requests are supported. Reversed or longer ranges return HTTP 400.
The computation uses Gregorian date arithmetic in UTC solely to represent civil
dates, independently of the server timezone, DST and Morocco's Ramadan clock
changes. Callers supply the Moroccan local calendar date they intend to query.

The model counts Monday–Friday weekdays and removes known holiday weekdays once.
A holiday on Saturday or Sunday does not remove an additional weekday. No
substitute Monday, bridge day or exceptional closure is inferred.

```json
{
  "data": {
    "from": "2026-03-19",
    "to": "2026-03-23",
    "inclusive": true,
    "calendar_days": 5,
    "weekend_days": 2,
    "holiday_weekdays": 1,
    "business_days": 2,
    "business_days_upper_bound": 2,
    "is_exact": true
  }
}
```

Responses also contain `meta` with the reviewed date, sources, legal basis,
transformation version, scope, queried years, pending day count and limitations.
When unconfirmed holidays could affect a weekday in the range, `business_days`
is `null`, `is_exact` is `false` and `business_days_upper_bound` removes only known
closures. A range consisting solely of known closures can have an exact zero
while `meta.calendar_complete` remains false for the year.

Under this model the full 2026 year has 246 business days. This describes the
common calendar; employee-specific religious observances, exceptional closures,
education/security exceptions, bank schedules and private-sector workweeks
need their own rules. An exact count does not establish that a particular
institution is open.

## Evidence and reuse

The [manifest](../sources/holidays/public-holidays.yml) records the official
decrees, dated Ministry of Habous announcements, review limitations and narrow
reuse basis. Recurring rules come from
[decree 2-77-169](https://bdj.mmsp.gov.ma/Front/ar/PrintDocument.aspx?id_doc=9417),
including decree 2.25.1140 in
[Bulletin Officiel 7480](https://www.sgg.gov.ma/BO/AR/3111/2026/BO_7480_Ar.pdf).
The standard workweek comes from
[decree 2-05-916](https://bdj.mmsp.gov.ma/Fr/Document/1983-D%C3%A9cret.aspx).

No blanket open license is asserted for ministry websites. Their explanatory
pages remain link-only. The integration contains normalized official legal
rules and simple date facts, relying on the exclusions in Article 8(a)/(c) of
[Law 2-00](https://www.wipo.int/wipolex/fr/legislation/details/19766), identified
as `LicenseRef-MA-Law-2-00-Article-8`. It does not copy page prose, images, layouts
or third-party calendar databases. This factual scope and reuse interpretation
are part of maintainer review for the PR; the Apache code license does not
relicense government websites.

## Maintaining the snapshot

Rules and reviewed first-day confirmations live in `src/holidays/data.ts`.
`src/holidays/calendar.ts` deterministically expands them without a live source
request. For an update, review the official text or announcement, record its
URL and date in the manifest, update the curated facts and reviewed date, and
update the expected-date tests. Extending `MAX_YEAR` also requires review of
legal changes and Gregorian-year religious coverage. Do not use astronomical
predictions as official confirmations. Failed source retrievals do not turn
unknown dates into confirmed dates or alter the pinned snapshot.

Run `npm run check` before submitting any update. The tests cover official
2026 dates, legal changes, all languages, strict dates, leap years, weekend
overlaps, consecutive holidays, incomplete and cross-year ranges, and OpenAPI.
