# Tensift dam water levels

This snapshot contains 305 daily observations for five dams in the Tensift
basin, from **2026-08-01 through 2026-09-30**. It was retrieved from ABHT's
official data.gov.ma publication on 2026-10-16. It is a historical monthly
release, with no observation after September 30 and no claim of national
coverage.

| File | Contents |
| --- | --- |
| `dams.json` | Stable MoroccoAPI IDs, source French names and the Tensift basin |
| `levels.json` | Dated reserves in Mm³, filling percentages and source normal capacities |
| `sources.json` | Official URLs, original license, publication dates, hashes and transformations |
| `ATTRIBUTION.md` | Source attribution and adapted database licensing |
| `raw/` | Unmodified official workbooks and a documented catalog metadata subset |

The producer is **Agence du bassin hydraulique de Tensift (ABHT)**. The
[official catalog](https://data.gov.ma/data/fr/dataset/situation-journaliere-des-barrages-dans-le-bassin-du-tensift)
explicitly declares the Open Data Commons Open Database License. This adapted
database is made available under [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

## Source meaning

Each workbook has one sheet (`Août_2026` or `Sept_2026`). Row 1 supplies dam
names, row 2 supplies normal capacity in Mm³, row 3 supplies measurement labels,
and rows 4 onward supply calendar day numbers. The month and year are explicit
in the sheet and resource names and corroborated by the catalog's temporal
coverage. A retrieval date or publication date is never substituted for an
observation date.

The five source names are preserved after trimming surrounding whitespace:
Yacoub El Mansour, Lalla Takerkoust, Sd Mohamed Ben Slimane El Jazouli,
Abou El Abess Sebti, and Bge My abdrhmane. No translated names, geographic
coordinates, administrative mappings or corrected spellings are inferred.

`volume_mm3` is the source reserve in millions of cubic metres. A value of
`41.61` means 41.61 Mm³. `filling_rate_pct` is a percentage on the 0–100 scale.
The workbook's cached numeric values are retained with no presentation rounding.
Percentages are checked against `volume_mm3 / capacity_mm3 * 100`, within
`1e-8` percentage points, but are not replaced by a recalculated result.

`capacity_mm3` is the explicit normal capacity in row 2 of the relevant monthly
source. It belongs to the observation's release, rather than asserting a
permanently current dam capacity. `source_id` identifies the resource in
`sources.json`; `source_ref` retains the source sheet and one-based row.
For every source row, the volume/filling columns are B/C, D/E, F/G, H/I and J/K,
in the source dam order above. Capacity is in row 2 of the same columns.

All 61 dates occur exactly once for each dam. Blank measurements are rejected
rather than interpreted as zero. The source supplies dates without time of day
or timezone. No timestamps, basin totals or operational observations are added.

## API

```text
GET /api/v1/dams?basin=tensift
GET /api/v1/dams/yacoub-el-mansour/levels?from=2026-09-01&to=2026-09-30
```

The dam collection returns stable `id`, source `name.fr`, `basin` and
`latest_level`. The five IDs are listed in `dams.json`. `latest_level` means
September 30, 2026 in this snapshot, not a current measurement. Other valid
basin slugs return an empty collection; an unknown dam returns 404.

History is sorted oldest first. Optional `from` and `to` filters accept valid
ISO calendar dates and include both bounds. A reversed range returns 400;
a valid range outside this snapshot returns an empty collection.

Both endpoints accept `limit` (default 100, maximum 500) and `offset` (default 0).
Filters are applied before pagination. `meta.total` is the complete matching
count, and `meta.pagination` describes the returned page. Responses include
source/license information and the historical snapshot coverage.

## Rebuild and verification

Python 3.10 or newer and the standard library are sufficient:

```sh
python scripts/dams/pipeline.py
python scripts/dams/pipeline.py --check
python -B -m unittest discover -s scripts/dams -p "test_*.py"
python scripts/dams/pipeline.py --download
```

The pipeline verifies SHA-256 hashes and byte sizes, checks the catalog's
license and temporal coverage, validates source headers and units, checks
finite numeric values and capacities, rejects duplicate/gapped days and
unexpected nonempty cells, and reconciles all 305 observations. `--check`
rebuilds in memory and fails if either JSON output differs without writing files.
The parser reads XLSX XML and cached values without executing formulas, links,
macros or embedded objects. The September workbook's extra formatting and
embedded objects are retained in the raw file but excluded from the dataset.

`raw/catalog-metadata.json` is a deterministic subset of the official
`package_show` response. It keeps dataset, license, producer, coverage and
resource evidence and omits contributor contact metadata. The original HTTP
response hash and the subset's hash are recorded in `sources.json`. Its selected
fields are defined in `catalog_snapshot` in the pipeline.

`--download` fetches all reviewed URLs, projects the catalog subset, and checks
all responses before replacing any raw files. Upstream URLs are mutable: a
changed file or catalog subset makes the command fail. Review the new source,
update the manifest and any coverage-dependent code/tests, and rebuild before
admitting a new release. A newer publication is never silently relabeled as
this snapshot.
