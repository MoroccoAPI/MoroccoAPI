# MoroccoAPI

<img src="assets/brand/moroccoapi-logo.png" alt="MoroccoAPI logo" width="160">

> Reliable, developer-friendly access to Morocco's public open data.

[![Status: Pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)](#project-status)
[![Code License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue)](LICENSE)
[![Data licenses: per dataset](https://img.shields.io/badge/data-per--dataset-green)](DATA_LICENSE.md)

MoroccoAPI is a community-driven, open-source project that turns reusable Moroccan public datasets into consistent, documented, and versioned APIs.

Public information is often distributed across spreadsheets, documents, portals, and incompatible schemas. MoroccoAPI aims to make approved open datasets easier to discover and use while preserving source attribution, licensing, provenance, and update history.

## Project status

**Pre-alpha.** The first API implementation and an approved regions dataset are available in the repository. No production service is deployed yet.

MoroccoAPI is an independent community project. It is not affiliated with, endorsed by, or operated by the Government of Morocco or any public institution.

## Current API

The current local pre-alpha build includes:

- Morocco's 12 administrative regions.
- An HCP-sourced normalization of 75 provinces/prefectures, Casablanca's 8
  prefectures of arrondissements, 1,503 communes, and 41 urban arrondissements.
- Arabic and French source labels, plus clearly identified MoroccoAPI English transliterations.
- Per-response source, license, freshness, or pending-review metadata.
- Multilingual, accent-insensitive region search.
- OpenAPI documentation and a health endpoint.

Available endpoints:

```text
GET /api/v1/regions
GET /api/v1/regions/{code}
GET /api/v1/provinces
GET /api/v1/provinces/{code}
GET /api/v1/prefectures-of-arrondissements
GET /api/v1/prefectures-of-arrondissements/{code}
GET /api/v1/communes
GET /api/v1/communes/{code}
GET /api/v1/arrondissements
GET /api/v1/arrondissements/{code}
GET /api/v1/locations/search?q={query}
GET /api/v1/status
GET /openapi.json
GET /docs
```

The administrative-geography endpoints are derived from HCP's official RGPH
2024 legal-population workbook. Responses include the source page, direct
workbook URL, CC BY 4.0 terms, and retrieval date. Every published administrative
record exposes HCP's official geographic code and Arabic/French labels;
province-level records distinguish `province` from `prefecture`.

The RGPH 2024 workbook's cercle parent code is preserved on communes as
`cercle_hcp_code`, but cercles are not exposed as a standalone dataset because
their legal organization changed after the census, including in 2025. Urban
centres are statistical units and are outside this administrative API scope.

## Run locally

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

The API starts at `http://127.0.0.1:3000`; interactive documentation is at `http://127.0.0.1:3000/docs`.

Before opening a pull request, run:

```bash
npm run check
```

## Example response

```json
{
  "data": {
    "code": "casablanca-settat",
    "hcp_code": "06",
    "type": "region",
    "name": {
      "ar": "الدار البيضاء-سطات",
      "fr": "Casablanca-Settat",
      "en": "Casablanca-Settat"
    }
  },
  "meta": {
    "dataset": "administrative-regions",
    "total": 1,
    "license": "CC-BY-4.0",
    "retrieved_at": "2026-09-25",
    "transformation_version": "2.0.0",
    "sources": [
      {
        "dataset": "Population légale du Royaume du Maroc selon les résultats du RGPH 2024",
        "producer": "Haut-Commissariat au Plan (HCP)",
        "source_url": "https://www.hcp.ma/Population-legale-du-Royaume-du-Maroc-repartie-par-regions-provinces-et-prefectures-et-communes-selon-les-resultats-du_a3975.html",
        "resource_url": "https://www.hcp.ma/file/242341/",
        "license": "CC-BY-4.0",
        "source_updated_at": "2024-11-22"
      }
    ]
  }
}
```

`code` values are stable MoroccoAPI slugs. `hcp_code` carries HCP's official
geographic code.

## Principles

1. **Source first:** every field must be traceable to an identified source.
2. **License before code:** a dataset is not integrated until redistribution rights are documented.
3. **Stable contracts:** breaking changes require a new API version.
4. **No personal-data lookup:** MoroccoAPI will not expose CIN, phone, address, or citizen-profile endpoints.
5. **Multilingual by design:** Arabic, French, and English names are supported when reliable translations exist.
6. **Freshness is visible:** responses identify the source and relevant update dates.
7. **Community governance:** decisions and changes are discussed publicly.

## Data licensing

Source code and data have separate licenses:

- Project code is available under the Apache License 2.0.
- Adapted databases derived from ODbL sources will be published under ODbL 1.0.
- Third-party datasets keep their original licenses and notices.
- Incompatible or unclear sources will not be merged into the public database.

Read [DATA_LICENSE.md](DATA_LICENSE.md) and [docs/DATASET_POLICY.md](docs/DATASET_POLICY.md) before proposing a source.

## Contributing

MoroccoAPI needs backend developers, data engineers, documentation writers, open-data researchers, designers, and community organizers.

The project is still defining its first public scope. Start with:

- [RFC 0001](docs/RFC-0001.md)
- [Roadmap](ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Governance proposal](GOVERNANCE.md)

## Security and responsible disclosure

Do not open public issues containing credentials, private data, or unredacted security vulnerabilities. See [SECURITY.md](SECURITY.md).

## Acknowledgements

MoroccoAPI is inspired by community public-data projects such as BrasilAPI. Inspiration does not imply affiliation.
