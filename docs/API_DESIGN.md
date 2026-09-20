# API Design

## Base path and versions

All public endpoints use a versioned base path:

```text
/api/v1
```

Breaking response changes require a new API version.

## Success envelope

```json
{
  "data": {},
  "meta": {
    "dataset": "administrative-regions",
    "total": 1,
    "license": "ODbL-1.0",
    "retrieved_at": "2026-09-21",
    "transformation_version": "1.0.0",
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
- Stable MoroccoAPI slugs are used in URLs until verified official codes are integrated. They are never presented as official government codes.
- Search is accent-insensitive where practical but preserves original spelling in responses.
- Unknown values are `null`; they are not fabricated or represented by misleading empty strings.
- Collection endpoints will add documented pagination when their size requires it.

## Deprecation

Deprecated versions receive a public notice and a migration guide. A removal timeline will be defined before the first stable release.
