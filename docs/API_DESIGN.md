# API Design Proposal

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
    "producer": "To be approved",
    "source_url": null,
    "license": "To be confirmed",
    "source_updated_at": null,
    "retrieved_at": null,
    "transform_version": 1
  }
}
```

## Collection envelope

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "page_size": 20,
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
    "status": 404,
    "request_id": "example-request-id"
  }
}
```

## Conventions

- JSON field names use `snake_case`.
- Dates use ISO 8601.
- Coordinates use WGS 84 and GeoJSON longitude/latitude order where GeoJSON is returned.
- Stable administrative codes are preferred over display names in URLs.
- Search is accent-insensitive where practical but preserves original spelling in responses.
- Unknown values are `null`; they are not fabricated or represented by misleading empty strings.
- Pagination limits are documented and enforced.

## Deprecation

Deprecated versions receive a public notice and a migration guide. A removal timeline will be defined before the first stable release.

