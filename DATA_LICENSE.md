# Data Licensing Notice

MoroccoAPI source code and MoroccoAPI datasets are separate works and may use different licenses.

## Adapted open databases

Adapted databases derived from sources published under the Open Data Commons Open Database License 1.0 will be made available under ODbL 1.0:

https://opendatacommons.org/licenses/odbl/1-0/

Each dataset directory must include its own provenance manifest and attribution notice. The original producer, source URL, original license, retrieval date, and material transformations must be identified.

## No blanket relicensing

MoroccoAPI does not claim ownership of third-party data and does not relicense data beyond the rights granted by its original source. Data under incompatible terms must remain separate or be excluded.

## Administrative regions database

The database in `data/administrative-regions.json` is adapted from HCP's
official RGPH 2024 legal-population workbook under CC BY 4.0 terms.

French and Arabic labels and `hcp_code` values come from HCP. English labels are
MoroccoAPI transliterations and are not official source translations.

Full provenance, direct resource URLs, retrieval dates, and transformations are recorded in `sources/administrative-regions.yml`.

## HCP administrative subdivisions

`data/administrative-provinces.json`,
`data/administrative-prefectures-of-arrondissements.json`,
`data/administrative-communes.json`, and
`data/administrative-arrondissements.json` are adapted from the same HCP RGPH
2024 source under CC BY 4.0 terms. All records preserve HCP's official code and
Arabic/French names. Each administrative level is stored separately.

Full provenance is recorded in `sources/administrative-subdivisions.yml`.

## Attribution format

> Contains information from "[DATASET NAME]", produced by [PRODUCER] and obtained from [SOURCE URL], made available under [SOURCE LICENSE]. Normalized by MoroccoAPI; transformation version [VERSION].

This file is not a substitute for the full license text or professional legal advice.
