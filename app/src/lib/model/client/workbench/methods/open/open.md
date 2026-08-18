# Method: `open`

Lives at `methods/open/open.md`.

Opening a target, and the two shapes that takes.

## Method Tree

```text
open(state, target)
├── targetKey()      ../shared/target-key.ts
└── adoptTarget()    ../shared/adopt-target.ts

resolveLauncher(state, id, target)   resolve-launcher.ts
├── targetKey()      ../shared/target-key.ts
└── adoptTarget()    ../shared/adopt-target.ts
```

`resolveLauncher` lives beneath `open` rather than beside it because it is the
second half of one flow: a launcher is a tab a user opened without yet saying
what for, and this is where they say. Both routes end in the same two shared
steps, and reading them apart hides that they are one identity rule.

## Identity is the whole of it

`targetKey` answers "is this already open", and it is the only definition of
that anywhere. A singleton keys on its screen, a resource on its type and id,
and **a launcher on nothing** — it returns `undefined`, so `open` finds no match
and mints every time. Open five launchers, get five tabs.

`adoptTarget` is the only place a tab is minted, which is what makes every
invariant about a tab hold by construction: `viewState.kind` always matches the
target, and `frame` is always fully populated.

## What resolving a launcher does

| The target is | What happens |
| --- | --- |
| Not open | The launcher **becomes** it — same `TabId`, same slot in the strip |
| Already open | The launcher closes, and the existing tab activates |

The first is the point. A user who typed into the launcher and picked a document
watches that tab turn into the document, rather than watching a tab vanish and
another appear at the far end of the strip.

The second is the identity rule winning: two tabs on one document is what
`targetKey` exists to prevent, and a launcher is the cheaper of the two to lose.

The resolved tab is **minted rather than patched**, keeping only the id. Carrying
the launcher's own view state across would leave a document tab holding a `query`
field and no `zoom`.

## Attaching

Opening a resource tab is what brings its runtime into being, because the
workbench is the thing that knows when a tab begins. `attach` is idempotent, so a
second tab on one document shares the first one's buffer rather than starting a
second — which is the whole reason the register is keyed by resource.

A view calling `attach` itself would tie runtime lifetime to a component's mount,
and the work surface remounts on every tab switch.

## Ordering

A new tab lands at the end. Singletons hold the leading positions and cannot be
dragged, so the closable ones are always a contiguous run at the end — which is
what lets `reorder` count them alone.
