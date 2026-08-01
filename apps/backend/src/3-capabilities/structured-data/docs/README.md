# Structured Data capability

## Status and authority

Structured Data is the implemented, project-scoped authority for Formula-visible named declarations. It stores variables, functions, tables, records, and lists under stable UUIDs; validates mutations at ingress; exposes revisioned CRUD and collection operations; and supplies point-in-time entry views to the Formula name resolver.

Name Manager has been removed. Formula language names (built-ins and lambda locals) remain owned by Formula; otherwise-unresolved project names come only from the Structured Data instance composed into [`FormulaNameResolver`](../../../1-init/create/formula-name-resolver.ts).

These documents describe current source behavior, including narrower runtime validation than some older design documents propose.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Authority, declarations, collection model, resolution, and architecture |
| [Types](types.md) | Entry/request/query/error families, store shape, SQLite and wire values |
| [Runtime](runtime.md) | Factory, every service method, validators, resolver, logging, and concurrency |
| [Flows](flows.md) | All 15 endpoints, Formula evaluation paths, and call sequences |
| [Invariants](invariants.md) | Admitted inputs, limits, identity/revisions, CAS, failure behavior, tests, and non-goals |

## Dependencies

- Project-scoped [`SQLiteDataStore`](../sqlite-store.ts).
- Shared [`Logger`](../../../0-platform/observability/logger.ts).
- [`ContextEntry`](../../context/types.ts) as stored relevance metadata and a query filter atom.
- Platform [`Formula`](../../../0-platform/formula/index.ts) plus the composition-layer Formula resolver for evaluated-value endpoints.
- The shared endpoint registry and concurrent queue.

The core `StructuredData` service does not itself call Formula, Context, Knowledge, or Intelligence. Formula parsing/evaluation happens in the resolver and endpoint integration layer.

## Source map

| Concern | Source |
|---|---|
| Domain types and errors | [`types.ts`](../types.ts) |
| Ingress validators/canonicalizers | [`validation.ts`](../validation.ts) |
| Persistence port | [`store.ts`](../store.ts) |
| Runtime interface and implementation | [`structured-data.ts`](../structured-data.ts) |
| SQLite adapter | [`sqlite-store.ts`](../sqlite-store.ts) |
| Public exports | [`index.ts`](../index.ts) |
| Factory | [`1-init/create/structured-data.ts`](../../../1-init/create/structured-data.ts) |
| Formula resolver adapter | [`1-init/create/formula-name-resolver.ts`](../../../1-init/create/formula-name-resolver.ts) |
| HTTP/job wiring and evaluated values | [`4-job-wiring/structured-data/registerStructuredDataEndpoints.ts`](../../../4-job-wiring/structured-data/registerStructuredDataEndpoints.ts) |
| Config defaults | [`loadBackendConfig.ts`](../../../0-utils/config/loadBackendConfig.ts) |
| Regression tests | [`structured-data-formula.test.ts`](../../../../test/capabilities/structured-data-formula.test.ts) |

## Related material

- [Structured Data design](../../../../../../scratch/structured-data-design.md)
- [Formula resolution design](../../../../../../scratch/formula-resolution-design.md)
- [Formula platform documentation](../../../../../../docs/platform/formula.md)
- [Recent capability fixes](../../../../../../scratch/recent-capabilities-fixes-2026-08-01.md)

Older Data documents describe a larger future aggregate. This package intentionally documents only the code under `structured-data`, its actual resolver adapter, and its registered endpoints.
