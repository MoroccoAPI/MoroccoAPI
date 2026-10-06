export const privateInfrastructureIndicators = [
  "clinics", "dental_practices", "medical_practices", "radiology_practices",
  "hemodialysis_centres", "physiotherapy_centres", "analysis_laboratories", "pharmacies", "infirmaries",
] as const;

export type PrivateInfrastructureIndicator = (typeof privateInfrastructureIndicators)[number];
