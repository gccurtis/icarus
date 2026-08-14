# API: `close`

Lives at `runtime-api/close/close.md`.

Called once, by the runtime shutdown sequence in `runtime/shutdown.ts`, after the web server
has stopped accepting requests and before observability flushes. No capability
calls it: a capability that closed the shared database would close it for
everyone.

## Classification

- **Owner:** `DatabaseRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`close.ts`](close.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `database` | `Kysely<BackendDatabase>` | The client to destroy, supplied by the runtime object |
| `pglite` | `PGlite` | The instance behind it |

## Output

`Promise<void>`

Resolves once both the client and the instance are released.

## Failures

None defined by this capability. A driver error from `destroy` or `close`
propagates to the shutdown sequence, which reports it and sets a failing exit
code.

## Effects

- The Kysely client is destroyed; queries issued after this reject.
- The PGlite instance is closed and its file handles released, unless Kysely has
  already closed it.

## Procedure Tree

```text
receive database, pglite
  1. Destroy the Kysely client.
     || Kysely closed PGlite as part of that
        1.a.1. skip step 2
  2. Close PGlite.
  3. return
```

The `pglite.closed` check is not defensive noise: Kysely closes PGlite after its
first query, so the check is what makes shutdown correct both for a runtime that
served traffic and for one that started and stopped without a single query.
