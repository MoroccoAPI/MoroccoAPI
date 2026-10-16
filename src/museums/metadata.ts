export function buildDatasetMeta(total: number) {
  return {
    dataset: "morocco-museums-fnm", total, license: "ODbL-1.0",
    retrieved_at: "2026-10-14", transformation_version: "1.0.0",
    source_version: "Septembre 2026",
    scope: "FNM inventory; not an exhaustive registry of all Moroccan museums",
    limitations: [
      "Visitor hours and tariffs describe the September 2026 source; current operation is unknown.",
      "Coordinates and verified English museum names are unavailable.",
      "The XLSX and guide contain 23 museums whereas the FNM website lists 22.",
      "Incomplete phones and works/hours conflicts remain unresolved and flagged.",
      "Tariff text does not include every free-entry or reduction condition in the guide.",
    ],
    sources: [
      {
        dataset: "Liste des musées au Maroc", producer: "Fondation Nationale des Musées (FNM)",
        source_url: "https://data.gov.ma/data/fr/dataset/cartographie-des-musees-au-maroc",
        resource_url: "https://data.gov.ma/data/fr/dataset/c4ec598a-a30d-496e-8252-4d3297395f77/resource/39c5b6d8-0396-42ef-8755-9e74fe2d790d/download/liste-des-musees.xlsx",
        license: "ODbL-1.0", source_updated_at: "2026-10-02",
      },
      {
        dataset: "Guide des musées du Maroc", producer: "Fondation Nationale des Musées (FNM)",
        source_url: "https://data.gov.ma/data/fr/dataset/guide-des-musees-du-maroc",
        resource_url: "https://data.gov.ma/data/fr/dataset/58999b09-b27c-4a7e-af5a-817ca91589d4/resource/6e5fb7c8-6b6c-4d70-8249-3662cd20b699/download/guide-des-23-musees-de-la-fnm.docx",
        license: "ODbL-1.0", source_updated_at: "2026-09-28",
      },
      {
        dataset: "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
        producer: "Haut-Commissariat au Plan (HCP)",
        source_url: "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
        resource_url: "https://www.hcp.ma/file/242341/", license: "CC-BY-4.0", source_updated_at: "2024-11-22",
      },
    ],
  };
}
