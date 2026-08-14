# Persistence Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `DatabaseRuntime` | [`database/`](database/database.md) | yes | Owns the open PGlite instance, the Kysely client over it, and their shutdown. |

## Construction Order

`createDatabase(logger)` needs nothing but the package directory and a logger, so
`build-runtime.ts` constructs it after configuration and observability — a failure to open the
database can then be logged and so that shutdown can close it before the logger
flushes. Every capability that persists state is constructed after it, taking its
`database` client.
