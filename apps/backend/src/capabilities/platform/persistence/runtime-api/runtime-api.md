# Persistence Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on `DatabaseRuntime`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `close` | [`close/`](close/close.md) | mutator | Destroys the Kysely client, then closes PGlite when it is still open. |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method. `database` and `pglite` are fields and take
no directory.

## Shared Procedures

No procedure has been promoted to `shared/`. There is one method.
