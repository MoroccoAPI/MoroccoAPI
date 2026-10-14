import type { EducationDatasetMeta } from "./types.js";

const producer = "Ministère de l'Éducation nationale, du Préscolaire et des Sports (MENPS)";

const privateSchools = {
  dataset: "Liste des établissements privés (juillet 2026)",
  producer,
  source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-prives-2023",
  resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-prives-2023/resource/1efc3be5-046e-438a-a6d0-9d9bac2dd492",
  license: "ODbL-1.0",
  source_updated_at: "2026-09-14",
} as const;

const sources = {
  "etablissement-prives": [privateSchools],
  "etablissement-publics-qualifiant": [{
    dataset: "Liste des établissements publics qualifiants (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-qualifiants",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-qualifiants/resource/3ce45071-bbb1-49b4-b8b3-00065c3a0f2e",
    license: "ODbL-1.0", source_updated_at: "2026-09-14",
  }],
  "etablissements-prives-cpge": [{
    dataset: "Liste des établissements privés CPGE (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-prive-cpge",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-prive-cpge/resource/98757b6a-e231-4b7a-8d76-c167014203d6",
    license: "ODbL-1.0", source_updated_at: "2026-09-16",
  }],
  "etablissements-publics-bts": [{
    dataset: "Liste des établissements publics BTS (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-bts-2013-2014",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-bts-2013-2014/resource/a8f0fc87-7ff2-41b4-840f-e95b161cb354",
    license: "ODbL-1.0", source_updated_at: "2026-09-16",
  }],
  "etablissements-publics-collegial": [{
    dataset: "Liste des établissements publics collégiaux (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-de-etablissements-publics-collegial",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-de-etablissements-publics-collegial/resource/e13f4f7f-054e-4186-8197-bccf1bb251d2",
    license: "ODbL-1.0", source_updated_at: "2026-09-14",
  }],
  "etablissements-publics-cpge": [{
    dataset: "Liste des établissements publics CPGE (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-cpge-2013-2014",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-cpge-2013-2014/resource/1b9011ae-89d8-47e7-8db6-84f4d829962a",
    license: "ODbL-1.0", source_updated_at: "2026-09-16",
  }],
  "etablissements-publics-primaire": [{
    dataset: "Liste des établissements publics primaires (juillet 2026)", producer,
    source_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-primaire",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-etablissements-publics-primaire/resource/f98bdb47-19a8-4f4d-8407-ae08b56305d5",
    license: "ODbL-1.0", source_updated_at: "2026-09-14",
  }],
  "universites-publiques": [{
    dataset: "Établissements de l’enseignement supérieur universitaire public ouverts, année 2023–2024",
    producer,
    source_url: "https://data.gov.ma/data/fr/dataset/etablissements-de-l-enseignement-superieur-universitaire-public-ouverts",
    resource_url: "https://data.gov.ma/data/fr/dataset/etablissements-de-l-enseignement-superieur-universitaire-public-ouverts/resource/fb9c2300-77f7-461c-86a5-9184b00e57d9",
    license: "ODbL-1.0",
    source_updated_at: "2025-02-19",
  }],
} as const;

export function buildEducationMeta(dataset: EducationDatasetMeta["dataset"], total: number): EducationDatasetMeta {
  return {
    dataset,
    total,
    license: "ODbL-1.0",
    retrieved_at: "2026-10-13",
    transformation_version: "1.0.0",
    sources: sources[dataset],
  };
}
