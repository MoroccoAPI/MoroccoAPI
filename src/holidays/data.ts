import type { Names } from "./types.js";

// Curated legal facts only; see sources/holidays/public-holidays.yml for reuse review.
export const MIN_YEAR = 2024;
export const MAX_YEAR = 2027;
export const REVIEWED_AT = "2026-10-13";
export const LEGAL_BASIS = "LicenseRef-MA-Law-2-00-Article-8";
export const LICENSE_URL = "https://www.wipo.int/wipolex/fr/legislation/details/19766";
export const HOLIDAY_DECREE = "https://bdj.mmsp.gov.ma/Front/ar/PrintDocument.aspx?id_doc=9417";
export const UNITY_DECREE = "https://www.sgg.gov.ma/BO/AR/3111/2026/BO_7480_Ar.pdf";
export const WORK_DECREE = "https://bdj.mmsp.gov.ma/Fr/Document/1983-D%C3%A9cret.aspx";

interface FixedRule {
  id: string;
  month_day: string;
  first_year: number;
  names: Names;
}

export const fixedRules: readonly FixedRule[] = Object.freeze([
  { id: "new-year", month_day: "01-01", first_year: 2024, names: { ar: "رأس السنة الميلادية", fr: "Nouvel An", en: "New Year's Day" } },
  { id: "independence-manifesto", month_day: "01-11", first_year: 2024, names: { ar: "ذكرى تقديم عريضة الاستقلال", fr: "Manifeste de l'indépendance", en: "Independence Manifesto Day" } },
  { id: "amazigh-new-year", month_day: "01-14", first_year: 2024, names: { ar: "رأس السنة الأمازيغية", fr: "Nouvel An amazigh", en: "Amazigh New Year" } },
  { id: "labour-day", month_day: "05-01", first_year: 2024, names: { ar: "عيد الشغل", fr: "Fête du Travail", en: "Labour Day" } },
  { id: "throne-day", month_day: "07-30", first_year: 2024, names: { ar: "عيد العرش", fr: "Fête du Trône", en: "Throne Day" } },
  { id: "oued-eddahab-day", month_day: "08-14", first_year: 2024, names: { ar: "يوم وادي الذهب", fr: "Journée de Oued Eddahab", en: "Oued Eddahab Day" } },
  { id: "revolution-day", month_day: "08-20", first_year: 2024, names: { ar: "ذكرى ثورة الملك والشعب", fr: "Révolution du Roi et du Peuple", en: "Revolution of the King and the People" } },
  { id: "youth-day", month_day: "08-21", first_year: 2024, names: { ar: "عيد الشباب", fr: "Fête de la Jeunesse", en: "Youth Day" } },
  { id: "unity-day", month_day: "10-31", first_year: 2026, names: { ar: "عيد الوحدة", fr: "Fête de l'Unité", en: "Unity Day" } },
  { id: "green-march", month_day: "11-06", first_year: 2024, names: { ar: "ذكرى المسيرة الخضراء", fr: "Marche Verte", en: "Green March Day" } },
  { id: "independence-day", month_day: "11-18", first_year: 2024, names: { ar: "عيد الاستقلال", fr: "Fête de l'Indépendance", en: "Independence Day" } },
].map((rule) => Object.freeze({ ...rule, names: Object.freeze(rule.names) })));

export const religiousRules = Object.freeze([
  { id: "islamic-new-year", days: 1, names: { ar: "رأس السنة الهجرية", fr: "Premier Moharram", en: "Islamic New Year" } },
  { id: "eid-al-fitr", days: 2, names: { ar: "عيد الفطر", fr: "Aïd Al Fitr", en: "Eid al-Fitr" } },
  { id: "eid-al-adha", days: 2, names: { ar: "عيد الأضحى", fr: "Aïd Al Adha", en: "Eid al-Adha" } },
  { id: "mawlid", days: 2, names: { ar: "عيد المولد النبوي", fr: "Aïd Al Mawlid", en: "Mawlid" } },
].map((rule) => Object.freeze({ ...rule, names: Object.freeze(rule.names) })));

export interface Confirmation {
  holiday_id: string;
  date: string;
  source_url: string;
  source_updated_at: string | null;
}

// First day only. Consecutive second days follow decree 2-77-169.
export const confirmations: readonly Confirmation[] = Object.freeze([
  { holiday_id: "islamic-new-year", date: "2026-06-17", source_updated_at: "2026-06-15", source_url: "https://habous.gov.ma/fr/meknes-tafilelt/6589-le-1er-moharram-du-nouvel-an-de-l%E2%80%99h%C3%A9gire-1448-correspond-au-mercredi-17-juin-minist%C3%A8re.html" },
  { holiday_id: "eid-al-fitr", date: "2026-03-20", source_updated_at: "2026-03-19", source_url: "https://www.habous.gov.ma/مراقبة-الأهلة-4/22224-عيد-الفطر-الجمعة-فاتح-شوال-1447-20-مارس-2026م.html" },
  { holiday_id: "eid-al-adha", date: "2026-05-27", source_updated_at: null, source_url: "https://www.habous.gov.ma/مراقبة-الأهلة-4/22409-مواقيت-الصلاة-لشهر-ذي-الحجة-1447هـ.html" },
  { holiday_id: "mawlid", date: "2026-08-25", source_updated_at: "2026-08-13", source_url: "https://habous.gov.ma/آخر-المقالات.html?id=1616%3Aمدرسة-الإمام-الشاطبي-الخاصة&start=100" },
].map((confirmation) => Object.freeze(confirmation)));
