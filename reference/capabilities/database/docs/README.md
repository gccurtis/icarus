# Database documentation

## Status and authority

The current Database platform directory is not a general database runtime. It contains one implemented adapter: [`SQLiteKnowledgeStore`](../knowledge-store.ts), the SQLite persistence implementation of the Knowledge platform's [`KnowledgeStore`](../../knowledge/store.ts) port.

There is no shared `Database` interface, migration runner, `create/database.ts` factory, migration ledger, capability repository registry, or process-wide connection. Several capabilities open their own SQLite databases outside this directory. The older [Database platform design](../../../../../../docs/platform/database.md) describes an intended broader boundary; it must not be read as implemented behavior.

## Documentation map

| Document | Contents |
| --- | --- |
| [Concepts](concepts.md) | The actual adapter boundary, project table names, and canonical/derived Knowledge data |
| [Types](types.md) | `KnowledgeStore` values, SQLite rows, serialization, and physical schema |
| [Runtime](runtime.md) | Constructor, every store operation, helpers, transaction scope, and lifecycle |
| [Flows](flows.md) | How Knowledge calls the adapter during add/remove/retrieve/scope resolution |
| [Invariants](invariants.md) | Concrete persistence guarantees, limits, and missing infrastructure |

## Implementation map

| Code | Responsibility |
| --- | --- |
| [`knowledge-store.ts`](../knowledge-store.ts) | Schema creation and the full SQLite adapter |
| [`knowledge/store.ts`](../../knowledge/store.ts) | Port implemented by the adapter |
| [`knowledge/types.ts`](../../knowledge/types.ts) | Domain values serialized by the adapter |
| [`create/knowledge.ts`](../../../initialization/runtimes/knowledge.ts) | Opens `./data/knowledge.db` for one `projectId` |
| [`knowledge/knowledge.ts`](../../knowledge/knowledge.ts) | Only production caller of the port |

## Surface summary

`SQLiteKnowledgeStore` supports source records, windows, lattice nodes, the corpus frontier, and stored level indexes. Bulk window/node writes and frontier replacement are individually transactional. A complete Knowledge ingestion or removal spans many store calls and is not one database transaction.

No direct tests currently instantiate this adapter. Most Knowledge behavior in [`derived-outputs.test.ts`](../../../../test/capabilities/derived-outputs.test.ts) uses an in-memory `KnowledgeStore` double.
