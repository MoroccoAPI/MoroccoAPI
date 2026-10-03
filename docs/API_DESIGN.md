# API Design

## Base path and versions

All public endpoints use a versioned base path:

```text
/api/v1
```

MoroccoAPI `1.0.0` is the first stable application version and serves the
`/api/v1` contract. Application release numbers and API path versions are
separate: compatible fixes and additions keep the same base path. Breaking
response changes require a new API version, such as `/api/v2`.

## Success envelope

```json
{
  "data": {},
  "meta": {
    "dataset": "administrative-regions",
    "total": 1,
    "license": "CC-BY-4.0",
    "retrieved_at": "2026-09-25",
    "transformation_version": "2.0.0",
    "sources": []
  }
}
```

## Collection envelope

```json
{
  "data": [],
  "meta": {
    "total": 0
  }
}
```

## Error envelope

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "request_id": "example-request-id"
  }
}
```

## Conventions

- JSON field names use `snake_case`.
- Dates use ISO 8601.
- Coordinates use WGS 84 and GeoJSON longitude/latitude order where GeoJSON is returned.
- Stable MoroccoAPI slugs are used in URLs. Every published administrative unit
  also exposes its verified HCP code in `hcp_code`.
- `cercle_hcp_code` is the commune's parent cercle in the RGPH 2024 snapshot;
  it is not presented as a current standalone cercle registry.
- Search is accent-insensitive where practical but preserves original spelling in responses.
- Unknown values are `null`; they are not fabricated or represented by misleading empty strings.
- Collection endpoints will add documented pagination when their size requires it.

## Deprecation

Before an API version is deprecated, its release notes and API documentation
announce the replacement version, a migration guide, and the planned removal
date. The deprecated version remains available until that announced date.

There is currently no planned removal date for `/api/v1`.
