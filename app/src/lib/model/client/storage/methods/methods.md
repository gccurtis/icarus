# Storage Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Storage's surface is one
method, and the flow behind it — and behind construction — is the format.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `saveWorkbench` | definition | [`../definition.ts`](../definition.ts) | mutator | Replaces the workbench section and schedules one write |
| `encode` / `decode` | file | [`serialize.ts`](serialize.ts) | — | The wire format, in both directions |

## Why `saveWorkbench` stays on the definition

It is two assignments and a call to the scheduler, and the scheduler is instance
state — a pending flag that exists so a burst of writes costs one serialization.
Extracting it would move three lines into a file and leave the state they guard
behind, which reads as delegation while splitting one idea across two places.

The rule it does not break: a definition holds state and delegates *flow*. There
is no flow here to delegate, which is why the object's only real execution lives
in `serialize.ts` instead.

## `serialize.ts` is not a public method, and belongs here anyway

`methods/` is the execution behind the surface, not a mirror of the interface.
`encode` is the execution behind `saveWorkbench`; `decode` is the execution behind
construction. Both are the same idea — the format this object's two directions
pass through — so they are one file rather than one per direction.

It sits under `methods/` rather than at the object root because the root holds
what an object *is*: its document, its index, its types, its state, and its
constructor. Everything else an object does lives here.

## State Access

Neither function receives instance state, and that is the point. `serialize.ts`
imports nothing but types: no DOM, no `$app/*`, no runes. That is what lets the
half of this object where every decision actually lives be tested directly, under
the node environment, against string literals — while the browser half stays two
lines around `localStorage`.

## Common Shape

```text
1. reject what could not be what it claims
2. drop it on its own rather than taking its parent with it
3. answer a value the rest of the application can use unchecked
```

## Concurrency

Both functions are synchronous and pure, so there is no state for a second caller
to observe half-changed. The one write that outlives a call is scheduled by the
definition, in a microtask, so a caller cannot see the store change mid-call.
