# MoroccoAPI

<img src="assets/brand/moroccoapi-logo.png" alt="MoroccoAPI logo" width="160">

> Reliable, developer-friendly access to Morocco's public open data.

[![Status: Proposal](https://img.shields.io/badge/status-proposal-orange)](#project-status)
[![Code License: Apache-2.0](https://img.shields.io/badge/code-Apache--2.0-blue)](LICENSE)
[![Data License: ODbL-1.0](https://img.shields.io/badge/data-ODbL--1.0-green)](DATA_LICENSE.md)

MoroccoAPI is a proposed community-driven, open-source project that turns reusable Moroccan public datasets into consistent, documented, and versioned APIs.

Public information is often distributed across spreadsheets, documents, portals, and incompatible schemas. MoroccoAPI aims to make approved open datasets easier to discover and use while preserving source attribution, licensing, provenance, and update history.

## Project status

**Proposal / pre-alpha.** No production API is available yet, and no dataset has been approved for redistribution.

MoroccoAPI is an independent community project. It is not affiliated with, endorsed by, or operated by the Government of Morocco or any public institution.

## Proposed first release

The first release will intentionally be small:

- Administrative regions.
- Provinces and prefectures.
- Communes.
- Public dataset provenance and freshness metadata.
- OpenAPI documentation and a public health endpoint.

Candidate endpoints:

```text
GET /api/v1/regions
GET /api/v1/regions/{code}
GET /api/v1/provinces
GET /api/v1/communes
GET /api/v1/communes/{code}
GET /api/v1/locations/search?q={query}
GET /api/v1/status
```

Later releases may include public educational and healthcare facilities, provided that each source passes the project's legal, provenance, and quality checks.

## Example response

```json
{
  "data": {
    "code": "06",
    "type": "region",
    "name": {
      "ar": "الدار البيضاء - سطات",
      "fr": "Casablanca-Settat",
      "en": "Casablanca-Settat"
    }
  },
  "meta": {
    "source": "To be approved",
    "source_url": null,
    "license": "To be confirmed",
    "source_updated_at": null,
    "retrieved_at": null
  }
}
```

The values above illustrate the proposed response contract. They are not an approved dataset.

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

- Project code is proposed under the Apache License 2.0.
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
