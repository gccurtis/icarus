# API: `resolve`

What an expression selects, right now. The function the whole model exists for.

Registered as `api.capabilities.resourceSets.resolve`, built from `projectQuery`,
so the caller's token is resolved to a membership before this runs and every read
below is inside the project the gate produced.

## Procedure Tree

```text
resolve(ctx, scope, expression, trail)
├── op "project"     → kindRefs() per stored kind      kind-refs.ts
├── op "kind"        → kindRefs(kind)                  kind-refs.ts
│   └── connectorFiles() when the kind is connector    connector-files.ts
├── op "resources"   → namedRefs(refs)                 named-refs.ts
│   └── connectorFiles(id) per connector ref           connector-files.ts
├── op "set"         → requireSet(), then resolve()    ../shared/require-set.ts
├── op "union"       → resolve() per member            resolve.ts
└── op "difference"  → resolve() twice, then subtract  resolve.ts
```

`RESOURCE_TABLES` in [`resource-tables.ts`](resource-tables.ts) is where each
kind's table is named, and the only place this capability knows about storage.
It sits beside `kind-refs.ts` and `named-refs.ts` rather than under either,
because both read it.

## It returns a snapshot and stores nothing

The refs are what the set meant at that moment. A consumer that needs to remember
what it actually saw — a derived output explaining its output — records the refs
and their revisions in its own row. The set stays lazy; the consumer captures.

## The trail is per path, not a visited set

`{ op: "set" }` pushes the set onto a `trail` that is passed *down* rather than
accumulated in one shared list. A set named twice in different branches of a
union is an ordinary expression; a set reachable from itself is a configuration
mistake that would otherwise recurse until the stack ran out.

The refusal carries the loop, closing on the set it came back to, so it reads as
`Everything → Narrower → Everything`. It is a payload field rather than a
sentence because whoever has to break the loop needs the names, and a client
cannot parse them out of English.

## A ref that resolves to nothing is dropped

For a resource deleted since the set was written, for one in another project, and
for an id minted for a different table — the same silence in all three cases. A
set outlives what it names, so refusing would make one deletion break every scope
that ever mentioned the thing; and telling the caller which case they hit would
confirm a row exists to someone with no right to know that.

**A missing *set* is different.** `{ op: "set" }` names something the author
chose deliberately, and resolving it to nothing would hide a broken expression
behind an empty answer, so that one refuses with "not found".

## Failures

| Error code | Cause |
| ---------- | ----- |
| `not-found` | `{ op: "set" }` names no set in the caller's project |
| `cycle` | a set is reachable from itself |
