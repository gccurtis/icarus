# Runtime Object: `DatabaseRuntime`

Lives at `runtime-objects/database/database.md`.

## Responsibility

`DatabaseRuntime` owns the backend's embedded PostgreSQL instance for one runtime
lifetime: it opens PGlite, exposes the single Kysely client capabilities query
through, and releases both on shutdown.

It deliberately does not own tables, schemas, migrations, or transactions. A
capability creates its own tables and starts its own transactions with the client
it is given.

## Interface

Declared in [`definition.ts`](definition.ts). `close` delegates to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry; this file issues no
queries.

```ts
export interface DatabaseRuntime {
  readonly database: Kysely<BackendDatabase>;
  readonly pglite: PGlite;
  close(): Promise<void>;
}
```

`PGliteDatabaseRuntime` is the implementing class.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `database` | `Kysely<BackendDatabase>` | The one query client. Capabilities take this and nothing else. |
| `pglite` | `PGlite` | The embedded PostgreSQL instance, exposed for shutdown and for the rare caller that needs the driver directly. |

## Constructor

`createDatabase(logger)` in [`constructor.ts`](constructor.ts). The logger is its
only parameter: the data directory is derived from the package root, so a runtime
cannot be pointed at another runtime's data by a caller's mistake. Opening and
closing are both recorded, since a slow or failed open is the startup step most
worth seeing.

### Construction Steps

```text
1. Resolve `<package root>/data/pglite` from the #package.json alias.
2. Open PGlite at that directory, creating it when it does not exist.
3. Wrap it in one Kysely client typed by BackendDatabase.
4. Return the PGliteDatabaseRuntime holding both.
```

## Invariants

- One instance per backend runtime; one PGlite process behind one Kysely client.
- The client outlives every capability constructed from it, and is destroyed only
  by `close`.
- The runtime object creates no table and runs no migration. It hands out a
  client and gets out of the way.
