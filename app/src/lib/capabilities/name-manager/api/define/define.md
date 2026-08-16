# API: `define`

Gives a value a name, and returns its id.

Registered as `api.capabilities.nameManager.define`, built from
`projectMutation`.

## Procedure Tree

```text
define(ctx, scope, input)
├── canonicalName(input.name)              ../shared/canonical-name.ts
├── findVariable(ctx, scope, name)         ../shared/find-variable.ts
│   └── refuse `name-conflict` before the type and the value are read
├── canonicalValue(declaredType, value)    canonical-value.ts
├── nextOrder(ctx, scope)                  define.ts
├── ctx.db.insert("nameVariables", …)      define.ts
└── record(ctx, scope, "defined")          ../../../activity/api/shared/record.ts
```

## The conflict is decided first, and that is behaviour

A redefinition reports `name-conflict` rather than whichever schema fault its
payload happened to carry. An author correcting a typo in a value should not be
told their value is malformed when the real problem is that the name is taken —
so the test for it sends a payload that is *both* a duplicate name and the wrong
kind, and asserts the name conflict.

## Uniqueness is this function's job

`(projectId, nameKey)` is unique and no index enforces it, because Convex has
none that can. The read-then-insert here is the whole enforcement point, and it
is safe for one reason: a Convex mutation is a serializable transaction. A
concurrent definition of the same name invalidates this one's read set and it
re-runs against the state that won — no retry loop, no version field, and no
second code path allowed to insert without the check.

## Nothing is evaluated

`canonicalValue` compares the value's kind against the declared type and stops.
A `function` declared as a `number` is refused as not-a-number; whether the call
would have worked is a question this capability cannot answer and does not ask.

## `definitionOrder` is a counter

One past the project's current highest, read off `by_project_and_order`. Creation
time nearly works and is subtly wrong: two definitions in the same millisecond
have no order under it. Removing a variable frees its number for reuse, which
changes nothing about the order of the rows that remain.
