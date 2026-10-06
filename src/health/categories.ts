export const hospitalCategories = [
  "HP", "HR", "HIR", "HPr", "HPsyP", "HPsyR", "CRO", "CPU",
] as const;

export type HospitalCategory = (typeof hospitalCategories)[number];
