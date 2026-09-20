# Dataset Policy

This policy applies to every dataset considered for MoroccoAPI.

## Acceptance requirements

A source is accepted only when reviewers can answer "yes" to all applicable questions:

- Is the producer clearly identified?
- Is the source URL stable and publicly documented?
- Is the exact license or written permission recorded?
- Does the license permit the planned extraction, transformation, and redistribution?
- Can attribution and share-alike obligations be satisfied?
- Has the dataset been reviewed for personal, sensitive, confidential, and security-relevant data?
- Are transformations reproducible and tested?
- Is update behavior defined?
- Can users see the source, freshness, and known limitations?

Public accessibility alone is not sufficient permission.

## Source classes

### Approved open source

A source with documented reuse and redistribution rights compatible with the intended integration.

### Link-only source

A useful source without sufficient redistribution rights. MoroccoAPI may list its metadata and link to it but must not copy or republish the dataset.

### Rejected source

A source involving personal data, prohibited redistribution, bypassed controls, unclear ownership, unacceptable risk, or an incompatible license.

## Personal data

MoroccoAPI will not publish endpoints for citizen identity, CIN, personal phone numbers, private addresses, or inferred personal profiles.

Publicly visible personal information is not automatically open data. Potential personal-data processing must be escalated for legal review and, where applicable, CNDP compliance before any integration.

## Provenance manifest

Every accepted dataset must have a machine-readable manifest containing at least:

```yaml
id: example-dataset
title: Example dataset
producer: Example public body
source_url: https://example.ma/dataset
resource_url: https://example.ma/data.xlsx
source_license: ODbL-1.0
license_url: https://opendatacommons.org/licenses/odbl/1-0/
retrieved_at: 2026-09-20
source_updated_at: null
update_frequency: unknown
contains_personal_data: false
redistribution_review: approved
transformation_version: 1.0.0
```

## Transformations

- Raw files must not be silently modified.
- Normalization steps must be reproducible.
- Records that fail validation must be reported, not silently invented.
- Manual corrections require evidence and an audit trail.
- Names in different languages must preserve source distinctions and uncertainty.

## Removal and correction

MoroccoAPI may suspend or remove a dataset when its license, provenance, accuracy, privacy status, or upstream availability becomes uncertain. Removal does not silently rewrite published history; a public notice should explain material changes.
