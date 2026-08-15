# API

Three functions, one directory each.

| Function | Effect | Browser-reachable |
| --- | --- | --- |
| [`set`](set/set.md) | mutator — upsert | yes, as a `command` |
| [`get`](get/get.md) | accessor — one key | yes, as a `query` |
| [`list`](list/list.md) | accessor — all keys | yes, as a `query` |

## The shape every entry has

```text
procedure(scope, input)
  └── record(operation, fields, async () => {
        admit the input
        open this project's database
        run the statement
        convert rows to canonical types
      })
```

`record` is called *inside* the entry rather than wrapping it. A wrapper above a
procedure can be bypassed by anything reaching the procedure directly; a call
inside it cannot. That is what replaced the runtime object this capability would
have had under the older standard — there is now no object to reach past.

## Where SQL lives

In the function that runs it. There is no `queries.ts` and no store: Kysely
already is the query layer, `db.selectFrom("settings")` already is the table
object, and it is fully typed against
[`persistence/tables.ts`](../persistence/tables.md).

A query moves to [`shared/`](shared/shared.md) when a second function needs it
*and* it preserves an invariant spanning them. Two functions wanting the same
lines is not the test.

## Scope is not a parameter these functions check

It is the first parameter and there is no default, so a procedure cannot run
without one — and a `Scope` only exists because `resolveScope` produced it, which
it does only for a project the asking user holds a handle to. There is no
membership check inside any of these three because there is nothing left to
check.
