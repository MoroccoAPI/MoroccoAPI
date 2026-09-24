# MoroccoAPI

<img src="assets/brand/moroccoapi-logo.png" alt="MoroccoAPI logo" width="160">

> Reliable, developer-friendly access to Morocco's public open data.

[![Status: Pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)](#project-status)
[![Code License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue)](LICENSE)
[![Data License: ODbL-1.0](https://img.shields.io/badge/data-ODbL--1.0-green)](DATA_LICENSE.md)

MoroccoAPI is a community-driven, open-source project that turns reusable Moroccan public datasets into consistent, documented, and versioned APIs.

Public information is often distributed across spreadsheets, documents, portals, and incompatible schemas. MoroccoAPI aims to make approved open datasets easier to discover and use while preserving source attribution, licensing, provenance, and update history.

## Project status

**Pre-alpha.** The first API implementation and an approved regions dataset are available in the repository. No production service is deployed yet.

MoroccoAPI is an independent community project. It is not affiliated with, endorsed by, or operated by the Government of Morocco or any public institution.

## Current API

The current local pre-alpha build includes:

- Morocco's 12 administrative regions.
- An HCP-sourced normalization of 75 provinces/prefectures and 1,539 communes.
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
GET /api/v1/communes
GET /api/v1/communes/{code}
GET /api/v1/locations/search?q={query}
GET /api/v1/status
GET /openapi.json
GET /docs
```

The province/prefecture and commune endpoints are built from data obtained from
the Haut-Commissariat au Plan (HCP) on 2026-09-24. Their responses identify HCP
as the producer and expose the retrieval date. The source URL and license remain
`null` with `review_status: "pending"` until those details are documented.
Later releases may include public educational and healthcare facilities under
the same rule.

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
    "type": "region",
    "name": {
      "ar": "الدار البيضاء - سطات",
      "fr": "Casablanca-Settat",
      "en": "Casablanca-Settat"
    }
  },
  "meta": {
    "dataset": "administrative-regions",
    "total": 1,
    "license": "ODbL-1.0",
    "retrieved_at": "2026-09-21",
    "transformation_version": "1.0.0",
    "sources": [
      {
        "dataset": "Répartition du personnel des administrations publiques selon les régions",
        "producer": "MTNRA",
        "source_url": "https://data.gov.ma/data/fr/dataset/repartition-du-personnel-des-administrations-publiques-selon-les-regions",
        "resource_url": "https://data.gov.ma/data/fr/dataset/5995a4d8-0a8a-4a29-9ba3-8ffd6264cb2f/resource/07555a6f-c648-4938-837d-46ce51908b8f/download/repartition-du-personnel-des-administrations-publiques-selon-les-regions.xlsx",
        "license": "ODbL-1.0",
        "source_updated_at": "2025-11-25"
      }
    ]
  }
}
```

Region `code` values are stable MoroccoAPI slugs, not official government administrative codes.

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
