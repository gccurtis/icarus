# Context capability

## Status and authority

Context is implemented as a project-scoped SQLite capability. There is no user
scope and no user/project fallback. Each project has a typed current table for
Contexts and a history table for superseded snapshots and terminal
deletion revisions. It stores named sets of typed resource references, expands
nested contexts, and provides pure and persisted set composition.

Context owns context identity, names, membership, descriptions, revision metadata, nesting, and composition. It does not own the referenced resource, decide whether a leaf kind is meaningful, or retrieve content. The runtime resource registry translates resolved leaves into Knowledge source IDs.

## Documentation map

| Document | Purpose |
|---|---|
| [Concepts](concepts.md) | Vocabulary, boundaries, architecture, and lifecycle |
| [Types](types.md) | Records, entries, errors, store contract, and SQLite representation |
| [Runtime](runtime.md) | Construction, every manager/store method, helpers, logging, and concurrency |
| [Flows](flows.md) | All 10 HTTP mappings and their call chains |
| [Invariants](invariants.md) | Actual guarantees, limits, failure behavior, tests, and known non-guarantees |

## Runtime dependencies

- A configuration-bound [`SQLiteContextStore`](../sqlite-store.ts).
- The shared [`Logger`](../../../0-platform/observability/logger.ts).
- `ContextEntry` and the `KnowledgeResourceResolver` structural contract from [Knowledge types](../../../0-platform/knowledge/types.ts).
- The request registry and in-memory scheduler at the HTTP boundary.
- The [runtime resource registry](../../../1-init/create/resource-reader.ts), which consumes `ContextManager.resolve` and maps known General File and Connector leaves to Knowledge source IDs.

There is no Intelligence, Formula, or network dependency in the Context manager itself.

## Source map

| Concern | Current source |
|---|---|
| Public record/error types | [`types.ts`](../types.ts) |
| Persistence port | [`store.ts`](../store.ts) |
| Runtime interface, implementation, and helpers | [`context.ts`](../context.ts) |
| SQLite schema and adapter | [`sqlite-store.ts`](../sqlite-store.ts) |
| Public exports | [`index.ts`](../index.ts) |
| Composition factory | [`1-init/create/context.ts`](../../../1-init/create/context.ts) |
| HTTP-to-job mappings | [`4-job-wiring/context/registerContextEndpoints.ts`](../../../4-job-wiring/context/registerContextEndpoints.ts) |
| Cross-capability resource mapping | [`1-init/create/resource-reader.ts`](../../../1-init/create/resource-reader.ts) |
| Limits and defaults | [`loadBackendConfig.ts`](../../../0-utils/config/loadBackendConfig.ts) |

## Related material

- [Original Context design](../../../../../../scratch/context-design.md) is useful background but contains proposals that are not all implemented, including the user/project dual-scope model this capability has since dropped.
- [Top-level Context capability page](../../../../../../docs/capabilities/context.md) describes the broader target architecture.
- [Runtime scope](../../../../../../docs/platform/runtime-scope.md) explains why project identity is bound at startup rather than accepted from arbitrary requests. `userId` still exists in `BackendConfig` for activity attribution but no longer selects a Context table.

When these pages disagree with those design documents, this package intentionally reports the code that runs today.
