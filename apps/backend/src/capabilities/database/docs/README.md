# Database documentation

## Current runtime

[`initialization/runtimes/database.ts`](../../../initialization/runtimes/database.ts) creates the
backend's one process-owned PGlite instance at `data/pglite` and exposes it through Kysely. It closes
with `Runtime.close()`. This is the persistence boundary for all returning capabilities.

There are intentionally no tables, migrations, repositories, or schema ledger yet. A capability that
becomes live adds its table definitions to `BackendDatabase` and owns the migration that creates them.

## Historical design

The documents below describe the former SQLite-backed Knowledge adapter. That implementation is not
part of the live backend and must not be used as the current PGlite contract; they remain as design
history until the Knowledge capability returns.

| Document | Contents |
| --- | --- |
| [Concepts](concepts.md) | Former adapter boundary, project table names, and canonical/derived Knowledge data |
| [Types](types.md) | Former `KnowledgeStore` values, SQLite rows, serialization, and physical schema |
| [Runtime](runtime.md) | Former constructor, store operations, helpers, transaction scope, and lifecycle |
| [Flows](flows.md) | How Knowledge calls the adapter during add/remove/retrieve/scope resolution |
| [Invariants](invariants.md) | Former persistence guarantees, limits, and missing infrastructure |
