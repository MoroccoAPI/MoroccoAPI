# API Design

## Base path and versions

All public endpoints use a versioned base path:

```text
/api/v2
```

The current contract uses `/api/v2`, including bounded collection pagination.
Application release numbers and API path versions are separate: compatible
fixes and additions keep the same base path. Future breaking response changes
require a new API path version.

Earlier application releases introduced pagination while still publishing
`/api/v1` paths. Those paths remain compatibility aliases for the behavior
already published, including pagination. They do not restore the unpaginated
1.x contract. Only `/api/v2` appears in OpenAPI and current examples.
See [the migration guide](MIGRATING_TO_V2.md).

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
    "total": 0,
    "pagination": {
      "limit": 100,
      "offset": 0,
      "count": 0,
      "has_more": false,
      "next_offset": null
    }
  }
}
```

This abbreviated example omits dataset-specific source metadata.
`meta.total` counts all matches after filtering; `meta.pagination.count` counts
only the records in this page. Request the next page with
`offset=meta.pagination.next_offset`, keeping the same filters and limit.
Stop when `next_offset` is `null`. The default limit is 100 and maximum is 500.

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

- Normalized JSON field names use `snake_case`. Maritime records retain their
  published French column names; the translated reference explains them.
- Dates use ISO 8601.
- Coordinates use WGS 84 and GeoJSON longitude/latitude order where GeoJSON is returned.
- Stable MoroccoAPI slugs are used in URLs. Every published administrative unit
  also exposes its verified HCP code in `hcp_code`.
- `cercle_hcp_code` is the commune's parent cercle in the RGPH 2024 snapshot;
  it is not presented as a current standalone cercle registry.
- Search is accent-insensitive where practical but preserves original spelling in responses.
- Unknown values are `null`; they are not fabricated or represented by misleading empty strings.
- Collection endpoints expose documented pagination. Fixed calendar calculations
  and individual-resource responses keep their own documented schemas.

## Deprecation

The old `/api/v1` aliases return `X-MoroccoAPI-Deprecated` and a `Link` header
with `rel="successor-version"` pointing to the equivalent v2 URL, including its
query string. GET and HEAD keep the current data, validation and CORS behavior.
No removal date is scheduled. A future removal requires an explicit announcement.
