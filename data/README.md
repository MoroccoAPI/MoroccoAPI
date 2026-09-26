# Administrative geography datasets

This directory contains the normalized MoroccoAPI database of Morocco's 12
administrative regions plus HCP-sourced datasets for 75 provinces/prefectures,
8 prefectures of arrondissements, and 1,503 communes, with the 41 urban
arrondissements stored separately.

The administrative datasets are normalized from HCP's RGPH 2024 workbook under
CC BY 4.0 terms. English labels, when present, are MoroccoAPI transliterations
and are not presented as official translations.

See [`../sources/administrative-regions.yml`](../sources/administrative-regions.yml)
and [`../sources/administrative-subdivisions.yml`](../sources/administrative-subdivisions.yml)
for source URLs, retrieval dates, checksums, and transformations. See
[`../DATA_LICENSE.md`](../DATA_LICENSE.md) for licensing details.

Every record carries HCP's official geographic code in `hcp_code` and preserves
HCP's Arabic and French names. The 1,503 communes, 8 prefectures of
arrondissements, and 41 arrondissements remain separate datasets. Missing
unofficial English labels are represented as `null`, not guessed.

The commune field `cercle_hcp_code` preserves the parent code in the RGPH 2024
workbook. Cercles are intentionally not published as a standalone dataset here:
their legal organization changed after that census. The source follows Morocco's
official territorial scope, including Moroccan-administered territory in Western
Sahara.
