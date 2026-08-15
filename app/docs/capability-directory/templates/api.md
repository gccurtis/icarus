# {{Capability Name}} API

Lives at `api/api.md`.

One directory per public function, named after the function in kebab-case,
containing an entry file of the same name that owns that function's complete
procedure. Supporting procedures used by only one function sit beside it in its
directory; a procedure a second function needs is promoted to
[`shared/`](shared/shared.md).

This is a list of **functions**, not a mirror of anything. The set is designed:
each entry is here because this capability means to offer it.

## Functions

| Function | Directory | Kind | Description |
| -------- | --------- | ---- | ----------- |
| `{{functionName}}` | [`{{function-name}}/`]({{function-name}}/{{function-name}}.md) | {{query / mutation}} | {{What it does}} |

## These are handlers, not registrations

Each entry takes a Convex `QueryCtx` or `MutationCtx` first and its own input as
the rest. It is plain TypeScript — nothing here calls `query()` or `mutation()`.

The registration lives at `src/convex/capabilities/{{capabilityName}}.ts`, because
a module only becomes a callable Convex function by sitting under the functions
directory, and because a file's path there *is* its public name. Keeping the
procedures out of that directory is what stops them becoming public API by
accident.

## Shared Procedures

{{Summarize what lives in shared/ and why, or state that no procedure has been
promoted yet.}}

Promotion means the procedure preserves an invariant that spans functions — not
merely that two call sites wanted the same code.

## Common Shape

{{The orchestration pattern these functions follow — for example: read current
state through the scoped index, build a candidate, write it, return the result.
State it once here so each function document can describe only what it does
differently.}}

```text
1. {{shared first step}}
2. {{shared second step}}
3. {{shared commit step}}
```

## Queries

A read or write lives with the function that runs it. One that two functions run
is promoted to `shared/` like any other procedure.

{{Note anything a reader should know before reading the queries: what is read,
the revision or concurrency scheme, whether reads are ordered and by what.}}
