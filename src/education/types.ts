export const schoolCategories = [
  "private-school",
  "private-cpge",
  "public-primary",
  "public-collegial",
  "public-qualifying",
  "public-bts",
  "public-cpge",
] as const;

export type SchoolCategory = typeof schoolCategories[number];
export type SchoolOwnership = "public" | "private";

export const schoolDatasetRoutes = [
  { category: "private-school", path: "etablissement-prives", dataset: "etablissement-prives", label: "Private schools" },
  { category: "public-qualifying", path: "etablissement-publics-qualifiant", dataset: "etablissement-publics-qualifiant", label: "Public qualifying schools" },
  { category: "private-cpge", path: "etablissements-prives-cpge", dataset: "etablissements-prives-cpge", label: "Private CPGE schools" },
  { category: "public-primary", path: "etablissements-publics-primaire", dataset: "etablissements-publics-primaire", label: "Public primary schools" },
  { category: "public-collegial", path: "etablissements-publics-collegial", dataset: "etablissements-publics-collegial", label: "Public collegial schools" },
  { category: "public-bts", path: "etablissements-publics-bts", dataset: "etablissements-publics-bts", label: "Public BTS establishments" },
  { category: "public-cpge", path: "etablissements-publics-cpge", dataset: "etablissements-publics-cpge", label: "Public CPGE schools" },
] as const;

export type SchoolDatasetKey = typeof schoolDatasetRoutes[number]["dataset"];
export type EducationDatasetKey = SchoolDatasetKey | "universites-publiques";

export interface EducationSchool {
  id: string;
  name_fr: string;
  name_ar: string;
  address_fr: string | null;
  address_ar: string | null;
  commune: string;
  province: string;
  region: string;
  category: SchoolCategory;
  ownership: SchoolOwnership;
}

export interface UniversityEstablishment {
  id: string;
  university_fr: string;
  university_ar: string;
  establishment_fr: string;
  establishment_ar: string;
  abbreviation: string;
  city: string;
  address: string | null;
  enrollment_2023_2024: number | null;
  telephone: string | null;
  fax: string | null;
}

export interface SchoolQuery {
  region?: string;
  province?: string;
  commune?: string;
  search?: string;
}

export interface UniversityQuery {
  city?: string;
  university?: string;
  search?: string;
}

export interface EducationDatasetMeta {
  dataset: EducationDatasetKey;
  total: number;
  license: "ODbL-1.0";
  retrieved_at: string;
  transformation_version: string;
  sources: readonly {
    dataset: string;
    producer: string;
    source_url: string;
    resource_url: string;
    license: "ODbL-1.0";
    source_updated_at: string;
  }[];
}
