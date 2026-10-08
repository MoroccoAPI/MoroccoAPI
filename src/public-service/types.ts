export interface GradeSalary {
  code: string;
  grade: { fr: string };
  corps: { ar: string };
  net_monthly_salary_mad: number;
  reference_url: string;
}

export interface DatasetSource {
  dataset: string;
  producer: string;
  source_url: string;
  resource_url: string;
  license: "CC-BY-4.0";
  source_updated_at: string;
}

export interface DatasetMeta {
  dataset: "public-service-salaries";
  total: number;
  license: "CC-BY-4.0";
  retrieved_at: string;
  transformation_version: string;
  value_type: "simulated-reference";
  notice: string;
  sources: readonly DatasetSource[];
}
