# Migrating to API v2

Use `/api/v2` as the base path for new integrations. This local change makes
the path version consistent with the paginated contract already published by
the application’s 2.x releases; it does not publish a new application release.

## Change the base path

```text
Before: GET /api/v1/communes?limit=100&offset=0
After:  GET /api/v2/communes?limit=100&offset=0
```

Resource identifiers, filters, JSON keys, source values and validation rules
remain the same. `/openapi.json` advertises only v2. Documentation URLs such as
`/docs/en/communes` remain stable; old `/docs?endpoint=/api/v1/...` selections
open the equivalent v2 reference.

## Read every page

Collections default to 100 records, with a maximum `limit` of 500. Do not assume
that `data` contains every matching record. `meta.total` is the complete match
count; `meta.pagination.count` is the size of the current page.

```js
const endpoint = new URL('https://moroccoapi.dev/api/v2/communes');
endpoint.searchParams.set('region_code', 'casablanca-settat');
endpoint.searchParams.set('limit', '100');
let offset = 0;
do {
  endpoint.searchParams.set('offset', String(offset));
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const { data, meta } = await response.json();
  for (const commune of data) console.log(commune.code);
  offset = meta.pagination.next_offset;
} while (offset !== null);
```

Keep the same filters between pages. A `null` next offset means the end, not 0.
Individual resources and calendar calculations have their own documented
response schemas and do not use this loop.

## Compatibility

Existing `/api/v1` GET and HEAD paths remain available as aliases to the
currently published behavior, including pagination. They return a
`X-MoroccoAPI-Deprecated` notice and a `Link` to the equivalent v2 URL.
There is no scheduled removal date. These aliases do not recreate the older,
unpaginated application 1.x behavior.

The deployment workflow now checks `/api/v2/status`. The interactive reference
explains every nested response property in French, English and Arabic, with
administrative definitions, units, source limitations and illustrative examples.
