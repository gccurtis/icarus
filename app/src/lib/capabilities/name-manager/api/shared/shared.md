# Name Manager Shared Procedures

A procedure belongs here once a second function in this capability needs it. It
sits inside `api/` rather than a capability-wide directory because it exists to
serve those functions, and both call trees stay visible through their imports.

A procedure used by exactly one function does not belong here — it belongs in that
function's directory. That is why the four `canonical-*` admission files live
under `api/define/`: `define` is the only function that writes.

## Procedures

| Procedure | Invariant it preserves | Used by | File |
| --- | --- | --- | --- |
| `canonicalName` / `nameKey` | one authored name has exactly one lookup form | define, get, require | [canonical-name.ts](canonical-name.ts) |
| `findVariable` | every reader finds a name by the same key | define, get, require | [find-variable.ts](find-variable.ts) |
| `copyVariable` | nothing shares an object with the catalog | define, get, require, list | [copy-variable.ts](copy-variable.ts) |
| `record` | every call leaves one trace, classified | all four | [record.ts](record.ts) |
| `stated` | a refusal reaches the browser; a fault does not | the four remote wrappers | [stated.ts](stated.ts) |

## Procedure: `canonicalName` and `nameKey`

Trims an authored name, admits it only as an ASCII identifier, and derives the
lowercased form used for storage and lookup.

```ts
export const canonicalName = (value: unknown, path: string): string => ...;
export const nameKey = (name: string): string => ...;
```

**Preserves:** two names differing only in casing are the same variable, while
the authored casing is what a caller is shown.

**Fails when:** the value is not a string, or does not match
`/^[A-Za-z_][A-Za-z0-9_]*$/` after trimming — `invalid-name`.

The pattern is narrower than "a non-empty string" on purpose. These names are
meant to be referenced from formulas, so a name needing quotes or escapes is a
name that will be got wrong. Widening later is possible; narrowing after people
have named things is not.

## Procedure: `findVariable`

Reads one declaration by its lookup key.

```ts
export const findVariable = (
  database: Kysely<Database>,
  nameKey: string
): Promise<NamedVariable | undefined> => ...;
```

**Preserves:** the three readers agree on what "the same name" means. That
agreement is the reason it is shared, not the query — if `get` and `define`
disagreed about the key form, `define` would admit a name `get` could never find.

**Fails when:** never on its own. Absence is `undefined`, and what that means is
the caller's decision: `get` reports it, `require` refuses.

It takes the key rather than the name because the caller has already run
`canonicalName`. Repeating that here would decide the shape of every caller's
error message.

The query carries **no project predicate**. A project is its own database, so the
database it is handed is the scope.

## Procedure: `copyVariable`

```ts
export const copyVariable = (variable: NamedVariable): NamedVariable => ...;
```

**Preserves:** no object reference is shared between the catalog and a caller, in
either direction.

`define` copies what it returns even though it just built the value, because that
value shares structure with the input the caller still holds — without the copy,
mutating that input afterwards would change what `define` appeared to return.

## Procedure: `record`

Every capability has this one, and it is why instrumentation lives here rather
than wrapping the entries: a wrapper above a procedure can be bypassed, and a
call inside it cannot.

```ts
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => ...;
```

**Records:** `name-manager.<operation>.started` on entry, `.completed` on
success, and `.rejected` or `.failed` on the two kinds of failure.

**Never records an authored value.** The catalog holds whatever someone put in
it, and a log is copied, shipped, and retained far longer than the row it
describes. A variable's *name* is an identifier and is safe; its value is not,
and neither is the field name of a record it contains.

**Classifies:** a `NameManagerError` is a decision this capability stated and is
logged at `warn` with its code; anything else is a fault and is logged at `error`.
Collapsing the two makes every ordinary rejection read like a bug, and real bugs
stop standing out.

## Procedure: `stated`

```ts
export const stated = async <T>(run: () => Promise<T>): Promise<T> => ...;
```

**Preserves:** a refusal arrives at the browser carrying its code; a fault stays
opaque.

**Only the remote wrappers call it.** A server-side caller catches
`NameManagerError` directly and has no use for an HTTP status, which is why the
translation lives at the boundary rather than inside `record`.
