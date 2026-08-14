# Persistence Overview

## Description

Persistence is the Platform capability that owns the backend's embedded
PostgreSQL database.

It opens PGlite once at startup, wraps it in a single Kysely client, and closes
both during shutdown, so that every capability that stores state queries through
the same connection and the same transaction scope.

## Boundary

Persistence owns:

- The PGlite instance, its on-disk location under `data/pglite`, and its
  lifetime.
- The one Kysely client every capability queries through.
- `BackendDatabase`, the interface each capability augments with the tables it
  owns.

Consumers own:

- Their tables: the schema, the SQL that creates it, the augmentation of
  `BackendDatabase` that types it, and the invariants it carries.
- Their transactions. Persistence hands out a client; it starts nothing.

## File Tree

```text
persistence/
├── overview.md
├── index.ts
├── types/
├── runtime-objects/
└── runtime-api/
```

## Dependency Ports

Persistence has no capability dependencies. It does not log: it is constructed
for its caller, and a failure to open the database is thrown to the caller that
holds the logger.

## Runtime Objects

One instance per backend runtime, constructed by
[`build-runtime.ts`](../../../runtime/runtime.md) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `DatabaseRuntime` | yes | The open PGlite instance and the Kysely client over it. | [database.md](runtime-objects/database/database.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `close` | runtime method | `DatabaseRuntime` | Destroys the Kysely client and closes PGlite. | [close.md](runtime-api/close/close.md) |

`database` and `pglite` are fields, not methods: a consumer holds the client and
issues its own queries.

## Data Ownership

Persistence stores nothing of its own. It owns no table — it owns the connection
that every other capability's tables live in, and the `BackendDatabase` interface
those capabilities augment.

## Capability Invariants

- One backend runtime opens exactly one PGlite instance and one Kysely client.
- Every capability queries through that client. Nothing opens a second
  connection to the same data directory.
- Closing is idempotent in effect: PGlite is closed only when it is still open,
  because Kysely may already have closed it.
- Table ownership never moves here. `BackendDatabase` stays empty in this
  capability and gains members only through augmentation elsewhere.
