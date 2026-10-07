export const hospitalCategories = [
  "HP", "HR", "HIR", "HPr", "HPsyP", "HPsyR", "CRO", "CPU",
] as const;

export type HospitalCategory = (typeof hospitalCategories)[number];

export const primaryCareCategories = ["CSU-1", "CSU-2", "CSR-1", "CSR-2", "DR"] as const;

export type PrimaryCareCategory = (typeof primaryCareCategories)[number];
