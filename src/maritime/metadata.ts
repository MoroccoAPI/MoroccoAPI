const sourceBase = {
  producer: "Ministère de l'Equipement et de l'Eau",
  source_url: "https://data.gov.ma/data/fr/organization/ministere-de-l-equipement-et-de-l-eau",
  license: "ODbL-1.0",
  source_updated_at: "2022-04-12",
} as const;

const sources = {
  ports: {
    ...sourceBase,
    dataset: "Liste des ports au Royaume du Maroc",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-ports-du-royaume-du-maroc/resource/fbd6a16a-c43f-4384-8177-616dc58a4df9",
  },
  lighthouses: {
    ...sourceBase,
    dataset: "Liste des phares au Royaume du Maroc",
    resource_url: "https://data.gov.ma/data/fr/dataset/liste-des-phares-au-royaume-du-maroc/resource/ff12e5b7-f1bf-4927-85f8-41d89c1949b1",
  },
} as const;

export function buildMaritimeMeta(kind: keyof typeof sources, total: number) {
  const label = kind === "ports" ? "ports" : "lighthouses";
  return {
    dataset: `morocco-${label}`,
    total,
    license: "ODbL-1.0",
    license_url: "https://opendatacommons.org/licenses/odbl/1-0/",
    retrieved_at: "2026-10-15",
    source_updated_at: "2022-04-12",
    transformation_version: "1.0.0",
    scope: `Ministry of Equipment and Water source list of Moroccan ${label}`,
    limitations: [
      "Source fields and labels are preserved as published; geographic labels are not standardized against MoroccoAPI administrative geography.",
      "The source snapshot dates to 12 April 2022 and does not establish current operational status.",
    ],
    sources: [sources[kind]],
  };
}
