# Knowledge documentation

## Status and authority

Knowledge is an implemented in-process platform runtime for admitting text sources, embedding overlapping windows, building a hierarchical similarity lattice, resolving resource scopes, and returning verbatim regions. It also emits source-mutation notifications and can expose an unscoped Intelligence tool binding.

These documents describe current source. The older [platform design page](../../../../../../docs/platform/knowledge.md) includes planned behavior that is not implemented, notably `retrieveMany`, query-time stored-level-index use, local repair in the active ingestion path, and some stronger atomicity/normalization claims.

## Documentation map

| Document | Contents |
| --- | --- |
| [Concepts](concepts.md) | Source/window/lattice/scope model and high-level algorithms |
| [Types](types.md) | Every public model, option, port, result, listener, and index type |
| [Runtime](runtime.md) | `Knowledge`, windowing, lattice, math, retrieval, repair, helpers, and logging |
| [Flows](flows.md) | Actual Connector, General Files, Derived Outputs, factory, and persistence call paths |
| [Invariants](invariants.md) | Preconditions, guarantees, non-guarantees, failure windows, and test status |

## Implementation map

| Area | Code |
| --- | --- |
| Public runtime | [`knowledge.ts`](../knowledge.ts), [`index.ts`](../index.ts) |
| Domain types/options | [`types.ts`](../types.ts) |
| Persistence port | [`store.ts`](../store.ts) |
| Embedding port/adapter | [`embedder.ts`](../embedder.ts) |
| Batch/stream windowing | [`windowing/text.ts`](../windowing/text.ts), [`windowing/stream.ts`](../windowing/stream.ts) |
| Cluster construction | [`lattice/cluster.ts`](../lattice/cluster.ts) |
| Retrieval descent/regions | [`lattice/descent.ts`](../lattice/descent.ts), [`lattice/regions.ts`](../lattice/regions.ts) |
| Approximate-neighbor support | [`lattice/knn.ts`](../lattice/knn.ts), [`lattice/math.ts`](../lattice/math.ts) |
| Repair helper | [`lattice/repair.ts`](../lattice/repair.ts) |
| SQLite adapter | [`database/knowledge-store.ts`](../../database/knowledge-store.ts) |
| Production composition | [`create/knowledge.ts`](../../../1-init/create/knowledge.ts), [`startBackend.ts`](../../../1-init/startBackend.ts) |
| Scope/resource adapter | [`create/resource-reader.ts`](../../../1-init/create/resource-reader.ts) |

## Public runtime surface

`Knowledge` exposes `onSourceMutation`, `add`, `remove`, `listSources`, `resolveScope`, `retrieve`, and `searchTool`. It does not expose HTTP routes or batch retrieval. Connector and General Files admit/remove sources; Derived Outputs resolves scopes and retrieves regions.

## Test status

There is no dedicated Knowledge test file. [`derived-outputs.test.ts`](../../../../test/capabilities/derived-outputs.test.ts) directly checks mutation notifications and frozen-scope integration using an in-memory store; Connector and General Files tests use Knowledge doubles. Windowing, clustering, SQLite persistence, end-to-end retrieval, and the concrete Intelligence embedder lack focused coverage.
