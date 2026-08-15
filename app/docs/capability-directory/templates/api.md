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

| Function | Directory | Browser | Effect | Description |
| -------- | --------- | ------- | ------ | ----------- |
| `{{functionName}}` | [`{{function-name}}/`]({{function-name}}/{{function-name}}.md) | {{yes / no}} | {{mutator / accessor}} | {{What it does}} |

**Browser** means a `{{function-name}}.remote.ts` exists. Its absence is a claim
that no view calls this function — not an oversight.

## Shared Procedures

{{Summarize what lives in shared/ and why, or state that no procedure has been
promoted yet.}}

Promotion means the procedure preserves an invariant that spans functions — not
merely that two call sites wanted the same code.

## Instrumentation

Every entry records its call through the shared instrumentation procedure. It
lives in `shared/` rather than wrapping the entries because a wrapper above the
procedure can be bypassed and a call inside it cannot — and a browser-reachable
call that leaves no trace is the one you most need a record of.

{{State what is recorded and, more importantly, what is deliberately not. A log
is copied, shipped, and retained far longer than the data it describes.}}

## Common Shape

{{The orchestration pattern these functions follow — for example: resolve the
project's database from scope, read current state under an expected revision,
build a candidate, commit under a compare-and-swap, return the result. State it
once here so each function document can describe only what it does differently.}}

```text
1. {{shared first step}}
2. {{shared second step}}
3. {{shared commit step}}
```

## Queries

SQL lives with the function that runs it, not in `persistence/`. A query one
function needs sits in that function's directory; a query two functions need is
promoted to `shared/` like any other procedure.

{{Note anything a reader should know before reading the queries: the tables
involved, the revision or concurrency scheme, whether reads are ordered and by
what.}}
