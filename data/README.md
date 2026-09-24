# Administrative geography datasets

This directory contains the normalized MoroccoAPI database of Morocco's 12
administrative regions plus HCP-sourced datasets for 75 provinces/prefectures
and 1,539 communes.

The database is distributed under the Open Data Commons Open Database License 1.0 (ODbL-1.0). It combines Arabic and French labels from two datasets published on the Moroccan open-data portal under ODbL. English labels are MoroccoAPI transliterations and are not presented as official translations.

See [`../sources/administrative-regions.yml`](../sources/administrative-regions.yml) for source URLs, producers, retrieval dates, and transformations. See [`../DATA_LICENSE.md`](../DATA_LICENSE.md) for licensing details.

The province/prefecture and commune JSON files are generated from data obtained
from the Haut-Commissariat au Plan (HCP) on 2026-09-24. Their detailed
provenance and license reviews are still pending, so they are not covered by
the approved regions source manifest and must not be redistributed as approved
MoroccoAPI data yet. Missing Arabic and English labels are represented as
`null`, not guessed.
