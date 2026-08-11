# Platform — Icarus Database Runtime & Persistence Boundary

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502814fa0fcda6f31f0a86f).

## Prerequisites
- Loaded backend configuration, including the database path and SQLite policy.
- Platform Logger construction.
- Capability migration registration during application initialization.
<callout icon="🗄️" color="gray_bg">
	**Platform authority.** Database owns connection lifecycle, transaction primitives, the migration runner, and the low-level SQLite driver adapter. Every capability repository adapter, migration definition, product table, query, revision rule, and derived projection remains owned by its capability.
</callout>
## Purpose and boundary
Location:
```plain text
apps/backend/src/0-platform/database/
apps/backend/src/1-init/create/database.ts
```
Database provides one injected runtime object. It has no HTTP endpoint and no Job Wiring registration.
It owns:
- opening and closing the configured database;
- SQLite pragmas and connection policy;
- transaction boundaries;
- migration discovery and application;
- prepared-statement and row-mapping primitives;
- test database construction;
- consistent database error translation.
It does not own:
- a universal repository;
- capability table names or SQL;
- cross-capability joins;
- domain revisions, ChangeSets, versions, or projections;
## Public interface
```typescript
export interface Database {
  read<T>(work: (connection: ReadConnection) => Promise<T>): Promise<T>;
  transaction<T>(
    work: (connection: TransactionConnection) => Promise<T>
  ): Promise<T>;
  close(): Promise<void>;
}

export interface CapabilityMigration {
  id: string;
  capability: string;
  apply(connection: MigrationConnection): Promise<void>;
}
```
Each capability registers its migrations during initialization. Duplicate migration IDs fail startup. Startup applies pending migrations before the Job Registry begins accepting requests.
## Physical model
Application initialization opens the SQLite database selected by top-level configuration. Capability repositories receive `Database` and execute only their own SQL. SQLite configuration should include:
- foreign keys enabled;
- WAL mode when compatible with the selected environment;
- explicit busy timeout;
- bounded transaction duration;
- UTC timestamps and opaque text IDs;
- parameterized SQL only.
The only Platform-owned canonical table is the migration ledger:
```plain text
schema_migrations
  migration_id TEXT PRIMARY KEY
  capability   TEXT NOT NULL
  checksum     TEXT NOT NULL
  applied_at   TEXT NOT NULL
```
## Index ownership
Database does not choose domain indexes. A capability page names every index it requires and ships it in that capability’s migration. Platform may expose test helpers that inspect query plans, but it does not create generic indexes.
## Runtime and queues
Database calls occur inside the Job selected by the requesting capability. Database never enqueues work and never changes serial/concurrent classification. Canonical mutations normally execute in serial Jobs; immutable reads and calculations may execute in concurrent Jobs.
## Observability
The adapter may log safe operational metadata through Platform Observability:
- migration ID and duration;
- transaction duration;
- busy/locked counts;
- database open/close;
- error class.
It must not generically log SQL parameters, source content, Evidence text, document bodies, or provider payloads.
## Invariants
- One process receives one Database runtime object from `1-init`.
- Every capability table has one named owner.
- Every mutation that spans tables inside one capability is transactional.
- Capability repositories never open their own hidden database connection.
- Migrations are ordered, checksummed, and idempotently recorded.
- Derived indexes can be deleted and rebuilt without erasing canonical state.
## Acceptance criteria
- Startup creates an empty SQLite database and applies all registered migrations once.
- Restart applies no migration twice.
- A failed migration prevents request admission.
- Capability repository tests run against isolated temporary databases.
- Concurrent reads and serial mutations behave predictably under WAL/busy policy.
## Sources
- [Icarus Platform database directory](https://github.com/gccurtis/icarus/tree/main/apps/backend/src/0-platform/database)
- <mention-page url="../runtime/backend-map.md"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f"/>
