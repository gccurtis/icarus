# Name Manager Shared Procedures

Two rules span the methods here: what makes a name, and what a caller may hold.
Both are invariants of the catalog boundary rather than steps in any one
procedure, so they live in one place and every method calls into them.

A procedure used by exactly one method does not belong here. Name Manager's
admission tree is the whole of `define` and stays in
[`define/`](../define/define.md), even though it is much larger than either
procedure below.

## Procedures

| Procedure | Invariant it preserves | Used by | File |
| --------- | ---------------------- | ------- | ---- |
| `canonicalName` | A name is a trimmed ASCII identifier, and it is that name wherever it appears | `define`, `get`, `require` | [canonical-name.ts](canonical-name.ts) |
| `nameKey` | Two names collide exactly when they differ only in case | `define`, `get`, `require` | [canonical-name.ts](canonical-name.ts) |
| `copyVariable` | The catalog and its callers share no mutable object | `define`, `get`, `require`, `list` | [copy-variable.ts](copy-variable.ts) |

## Procedure: `canonicalName` and `nameKey`

`canonicalName` trims an authored string and admits it only if it matches
`[A-Za-z_][A-Za-z0-9_]*`. `nameKey` lower-cases an already-canonical name to get
the lookup key.

```ts
export const canonicalName = (value: unknown, path: string): string => ...;
export const nameKey = (name: string): string => ...;
```

They are one rule in two halves, and are used together everywhere: the authored
casing is what gets stored and returned, and the lower-cased key is what decides
identity. Splitting them across directories would let one method store under a
key another method could never look up — and the failure would look like a
missing variable, not like a disagreement about names.

`canonicalName` also validates field names and reference values inside `define`,
which is why a reference is stored trimmed: it is a name, and names are trimmed.

**Preserves:** a stored name is a trimmed ASCII identifier, and a lookup finds it
under any casing.

**Fails when:** the value is not a string, or does not match the identifier
pattern after trimming — `invalid-name` in both cases.

## Procedure: `copyVariable`

Deep-clones a declaration through `structuredClone`.

```ts
export const copyVariable = (variable: NamedVariable): NamedVariable => ...;
```

`define` builds the admitted declaration fresh from the authored input and
returns a copy; the accessors copy values reconstructed by the store. A caller
can therefore mutate anything it holds without reaching persistent state, and
two callers cannot reach each other.

**Preserves:** no object reachable from a stored declaration is reachable from
any caller.

**Fails when:** never, for admitted declarations — every value the algebra admits
is structured-cloneable.
