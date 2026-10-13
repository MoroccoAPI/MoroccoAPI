import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";

import { buildApp } from "../../src/app.js";

let app: FastifyInstance;
before(async () => { app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); });

describe("Moroccan holidays", () => {
  it("publishes all 18 common holiday days for 2026 with official evidence", async () => {
    const response = await app.inject("/api/v1/holidays/2026");
    assert.equal(response.statusCode, 200);
    const { data, meta } = response.json();
    assert.equal(data.length, 18);
    assert.equal(meta.total, 18);
    assert.equal(meta.calendar_complete, true);
    assert.equal(meta.pending_holiday_days, 0);
    assert.equal(meta.scope, "public-administration-common-calendar");
    assert.equal(meta.license, "LicenseRef-MA-Law-2-00-Article-8");
    assert.equal(meta.reviewed_at, "2026-10-13");
    assert.equal(meta.sources.length, 7);
    assert.ok(data.every((row: { source_urls: string[] }) => row.source_urls.length > 0));
    assert.deepEqual(data.map((row: { date: string }) => row.date), [
      "2026-01-01", "2026-01-11", "2026-01-14", "2026-03-20", "2026-03-21", "2026-05-01",
      "2026-05-27", "2026-05-28", "2026-06-17", "2026-07-30", "2026-08-14", "2026-08-20",
      "2026-08-21", "2026-08-25", "2026-08-26", "2026-10-31", "2026-11-06", "2026-11-18",
    ]);
  });

  it("returns all three language labels together without a redundant selected name", async () => {
    const response = await app.inject("/api/v1/holidays/2026");
    assert.equal(response.statusCode, 200);
    const row = response.json().data.find((holiday: { id: string }) => holiday.id === "amazigh-new-year");
    assert.equal(row.date, "2026-01-14");
    assert.deepEqual(row.names, {
      ar: "رأس السنة الأمازيغية", fr: "Nouvel An amazigh", en: "Amazigh New Year",
    });
    assert.equal(Object.hasOwn(row, "name"), false);
    const checked = await app.inject("/api/v1/holidays/check?date=2026-01-14");
    assert.equal(checked.statusCode, 200);
    assert.deepEqual(checked.json().data.holidays[0], row);
  });

  it("retains unknown religious dates and applies Unity Day only from 2026", async () => {
    for (const year of [2024, 2025, 2027]) {
      const { data, meta } = (await app.inject(`/api/v1/holidays/${year}`)).json();
      assert.equal(meta.calendar_complete, false);
      assert.equal(meta.pending_holiday_days, 7);
      assert.equal(data.filter((row: { date: string | null }) => row.date === null).length, 7);
      assert.ok(data.filter((row: { date: string | null }) => row.date === null).every((row: { status: string }) => row.status === "pending_confirmation"));
      assert.equal(data.some((row: { id: string }) => row.id === "unity-day"), year >= 2026);
    }
  });

  it("checks fixed, religious, weekend and ordinary dates through the literal check route", async () => {
    for (const [date, isHoliday, isWeekend, isBusinessDay] of [
      ["2026-01-14", true, false, false], ["2026-03-21", true, true, false],
      ["2026-05-28", true, false, false], ["2026-08-26", true, false, false],
      ["2026-10-31", true, true, false], ["2026-11-02", false, false, true],
      ["2026-11-01", false, true, false],
    ] as const) {
      const response = await app.inject(`/api/v1/holidays/check?date=${date}`);
      assert.equal(response.statusCode, 200);
      const { data } = response.json();
      assert.equal(data.is_holiday, isHoliday, date);
      assert.equal(data.is_weekend, isWeekend, date);
      assert.equal(data.is_business_day, isBusinessDay, date);
    }
  });

  it("does not label an unconfirmed weekday as a known business day", async () => {
    const { data } = (await app.inject("/api/v1/holidays/check?date=2027-03-08")).json();
    assert.equal(data.is_holiday, null);
    assert.equal(data.is_business_day, null);
    const weekend = (await app.inject("/api/v1/holidays/check?date=2027-03-07")).json().data;
    assert.equal(weekend.is_holiday, null);
    assert.equal(weekend.is_business_day, false);
    const fixed = (await app.inject("/api/v1/holidays/check?date=2027-01-14")).json().data;
    assert.equal(fixed.is_holiday, true);
    assert.equal(fixed.is_business_day, false);
  });

  it("rejects malformed years, impossible dates and timestamps", async () => {
    for (const url of [
      "/api/v1/holidays/2023", "/api/v1/holidays/2028", "/api/v1/holidays/26", "/api/v1/holidays/2026.0",
      "/api/v1/holidays/check", "/api/v1/holidays/check?date=2026-02-29",
      "/api/v1/holidays/check?date=2026-04-31", "/api/v1/holidays/check?date=2026-13-01",
      "/api/v1/holidays/check?date=2026-01-00", "/api/v1/holidays/check?date=2026-1-01",
      "/api/v1/holidays/check?date=2026-01-01T00:00:00Z", "/api/v1/holidays/check?date=2028-01-01",
      "/api/v1/holidays/check?date=2026-01-01&date=2026-01-02",
    ]) {
      const response = await app.inject(url);
      assert.equal(response.statusCode, 400, url);
      assert.equal(typeof response.json().error.code, "string");
      assert.equal(typeof response.json().error.request_id, "string");
    }
    assert.equal((await app.inject("/api/v1/holidays/check?date=2024-02-29")).statusCode, 200);
  });
});

describe("Business days", () => {
  it("counts an inclusive range and avoids subtracting weekend holidays twice", async () => {
    const response = await app.inject("/api/v1/business-days?from=2026-03-19&to=2026-03-23");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data, {
      from: "2026-03-19", to: "2026-03-23", inclusive: true, calendar_days: 5,
      weekend_days: 2, holiday_weekdays: 1, business_days: 2, business_days_upper_bound: 2, is_exact: true,
    });
  });

  it("counts the full 2026 year as 246 business days under the documented model", async () => {
    const data = (await app.inject("/api/v1/business-days?from=2026-01-01&to=2026-12-31")).json().data;
    assert.equal(data.calendar_days, 365);
    assert.equal(data.weekend_days, 104);
    assert.equal(data.holiday_weekdays, 15);
    assert.equal(data.business_days, 246);
    assert.equal(data.is_exact, true);
  });

  it("handles a single day, second religious holiday days, and no substitute Mondays", async () => {
    for (const [date, count] of [["2026-01-14", 0], ["2026-05-28", 0], ["2026-08-26", 0], ["2026-10-31", 0], ["2026-11-02", 1]]) {
      const response = await app.inject(`/api/v1/business-days?from=${date}&to=${date}`);
      assert.equal(response.statusCode, 200);
      assert.equal(response.json().data.business_days, count);
    }
  });

  it("returns an upper bound for uncertain ranges, including across a year boundary", async () => {
    const { data, meta } = (await app.inject("/api/v1/business-days?from=2026-12-31&to=2027-01-04")).json();
    assert.equal(data.business_days, null);
    assert.equal(data.business_days_upper_bound, 2);
    assert.equal(data.is_exact, false);
    assert.deepEqual(meta.years, [2026, 2027]);
    assert.equal(meta.calendar_complete, false);
    const weekend = (await app.inject("/api/v1/business-days?from=2027-03-06&to=2027-03-07")).json();
    assert.equal(weekend.data.business_days, 0);
    assert.equal(weekend.data.is_exact, true);
    assert.equal(weekend.meta.calendar_complete, false);
  });

  it("supports leap years and exactly 366 days but rejects longer or reversed ranges", async () => {
    const response = await app.inject("/api/v1/business-days?from=2024-01-01&to=2024-12-31");
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.calendar_days, 366);
    for (const url of [
      "/api/v1/business-days?from=2024-01-01&to=2025-01-01",
      "/api/v1/business-days?from=2026-01-02&to=2026-01-01",
      "/api/v1/business-days?from=2026-02-30&to=2026-03-01",
      "/api/v1/business-days?from=2026-01-01", "/api/v1/business-days?to=2026-01-01",
      "/api/v1/business-days?from=2023-12-31&to=2024-01-01",
    ]) assert.equal((await app.inject(url)).statusCode, 400, url);
  });

  it("documents all three endpoints, errors and nullable uncertainty in OpenAPI", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    for (const path of ["/api/v1/holidays/{year}", "/api/v1/holidays/check", "/api/v1/business-days"]) {
      assert.ok(spec.paths[path].get.responses["200"]);
      assert.ok(spec.paths[path].get.responses["400"]);
      assert.deepEqual(spec.paths[path].get.tags, ["Holidays"]);
      assert.ok(!(spec.paths[path].get.parameters ?? []).some((parameter: { name: string }) => parameter.name === "lang"));
    }
    const holidaySchema = spec.paths["/api/v1/holidays/{year}"].get.responses["200"].content["application/json"].schema.properties.data.items;
    assert.deepEqual(holidaySchema.properties.names.required, ["ar", "fr", "en"]);
    assert.equal(Object.hasOwn(holidaySchema.properties, "name"), false);
    const dataSchema = spec.paths["/api/v1/business-days"].get.responses["200"].content["application/json"].schema.properties.data;
    assert.ok(dataSchema.properties.business_days.anyOf.some((item: { nullable?: boolean }) => item.nullable === true));
  });
});
