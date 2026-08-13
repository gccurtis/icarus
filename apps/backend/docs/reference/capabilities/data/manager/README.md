# Structured Data capability

## Status and authority

Structured Data is the implemented, project-scoped authority for
Formula-visible named declarations. A typed current table stores variables,
functions, tables, records, and lists under stable UUIDs; a capability history
table stores superseded snapshots and terminal deletion revisions. The service
validates mutations at ingress, exposes revisioned CRUD/collection operations,
and supplies current entry views to the Formula name resolver.

Name Manager has been removed. Formula language names (built-ins and lambda locals) remain owned by Formula; otherwise-unresolved project names come only from the Structured Data instance composed into `FormulaNameResolver`.

These documents describe current source behavior, including narrower runtime validation than some older design documents propose.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Authority, declarations, collection model, resolution, and architecture |
| [Types](types.md) | Entry/request/query/error families, store shape, SQLite and wire values |
| [Runtime](runtime.md) | Factory, every service method, validators, resolver, logging, and concurrency |
| [Flows](flows.md) | All 16 endpoints, Formula evaluation paths, and call sequences |
| [Invariants](invariants.md) | Admitted inputs, limits, identity/revisions, CAS, failure behavior, tests, and non-goals |

## Dependencies

- Project-scoped `SQLiteDataStore`.
- Shared `Logger`.
- `ContextEntry` as stored relevance metadata and a query filter atom.
- Platform `Formula` plus the composition-layer Formula resolver for evaluated-value endpoints.
- The shared endpoint registry and concurrent queue.

The core `StructuredData` service does not itself call Formula, Context, Knowledge, or Intelligence. Formula parsing/evaluation happens in the resolver and endpoint integration layer.

## Source map

| Concern | Source |
|---|---|
| Domain types and errors | `types.ts` |
| Ingress validators/canonicalizers | `validation.ts` |
| Persistence port | `store.ts` |
| Runtime interface and implementation | `structured-data.ts` |
| SQLite adapter | `sqlite-store.ts` |
| Public exports | `index.ts` |
| Factory | `initialization/runtimes/structured-data.ts` |
| Formula resolver adapter | `initialization/runtimes/formula-name-resolver.ts` |
| HTTP/job wiring and evaluated values | `api/routes/structured-data/registerStructuredDataEndpoints.ts` |
| Config defaults | `loadBackendConfig.ts` |
| Regression tests | `structured-data-formula.test.ts` |

## Related material

- `Structured Data design`
- `Formula resolution design`
- `Formula platform documentation`
- `Recent capability fixes`

Older Data documents describe a larger future aggregate. This package intentionally documents only the code under `structured-data`, its actual resolver adapter, and its registered endpoints.
