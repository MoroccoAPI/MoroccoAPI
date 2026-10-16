# Attribution and database license

Contains information from **“Situation journalière des barrages dans le bassin
du Tensift”**, produced by **Agence du bassin hydraulique de Tensift (ABHT)**
and obtained from the [official Moroccan Open Data portal](https://data.gov.ma/data/fr/dataset/situation-journaliere-des-barrages-dans-le-bassin-du-tensift),
made available under the **Open Data Commons Open Database License (ODbL)**.
Normalized by MoroccoAPI, transformation version **1.0.0**, retrieved
**2026-10-16**. The observations cover **2026-08-01 to 2026-09-30**.

The adapted database in this directory is made available under the
[Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The original official metadata declares `license_id: odc-odbl`,
`license_title: Open Data Commons Open Database License (ODbL)`, and
`license_url: https://opendefinition.org/licenses/odc-odbl`.
The preserved declaration is in `raw/catalog-metadata.json`.

MoroccoAPI reshapes the monthly workbook columns into a dated table, assigns
stable source-derived dam IDs, trims whitespace around source names and records
source sheet/row references. Numeric source observations and monthly normal
capacities are preserved. There are no inferred observations or translations.

The MoroccoAPI source code's Apache-2.0 license is separate from this database's
ODbL 1.0 terms. Retain this notice, the producer attribution and the database
license when reusing the adapted database. Resource URLs, checksums, retrieval
dates and material transformations are recorded in `sources.json` and
`../../sources/dams.yml`.
