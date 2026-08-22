# View State

Lives at the object root as `view-state.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

View state holds **what a person has open, and what they are looking at inside
it**, for the four panel trees: `context/` (90 views), `inspector/` (89 lenses),
`workspaces/` (17 centres over 11 screens) and `modals/`.

One object, and the five shell surfaces are functions of it — the tab strip, the
context panel, the centre, the inspector and the status bar own almost nothing
between them and write back only through these methods. There is no event bus, no
store subscription and no surface-to-surface communication: the state is `$state`
and Svelte's reactivity is the whole delivery mechanism. That reasoning is the
workbench's and carries over unchanged; it is set out in
[the workbench design record](../../../../../../docs/client-model/workbench.md).

## Why this is a new object rather than a wider workbench

The two answer the same three questions for two different sets of screens: the
workbench for the shell as it is, this for the shell as
[`docs/panel-trees`](../../../../../docs/panel-trees/panel-trees.md) and the
specifications behind it describe it. They cannot be one object during the
change, because the key vocabularies are different sizes — eighteen context ids
against ninety, a two-arm inspection union against eighty-nine — and both are
consumed through total `Record` maps. Widening a const array under a total map is
a rewrite of every consumer rather than an edit, which is the blocker
[`ClientModel`](../types.ts) records and the one the workbench record's landing
section already named.

So they stand beside each other. The workbench goes when the shell stops
rendering `views/workspace`.

**What carries over from the workbench, unchanged in substance:** singletons that
are one per project and always open; permanence derived rather than stored; one
identity function deciding "already open"; the launcher that never dedupes; the
reopen queue holding whole tabs; the two deliberate asymmetries around the rail;
the model holding values while views hold bounds; and no component type entering
the model.

**What is new here:** the subscreen, as a first-class part of what a tab is; a
key vocabulary generated from the trees instead of hand-written in `views/`; the
selection kept once, beside the inspection key rather than inside it; and no
persistence at all — this object takes no storage, so it has no counterpart to
`PERSISTED_FIELDS`.

## Ownership Boundary

View state owns:

- What is open, in what order, and which one is active
- Everything a tab carries: its screen and subscreen, the resource it edits, its
  rail position, its inspection, its selection and its frame
- The reopen queue
- **The rail map** — which context views each subscreen offers, and which one it
  opens on

Consumers own:

- **Which component a key resolves to.** This object publishes stable keys; the
  four trees hold the files, and the resolution is the shell's
- **Bounds.** The model records a width; the panel that enforces the drag knows a
  minimum, a maximum and a collapse threshold
- **Everything stored.** A tab is client state; a document, a person, a finding
  are rows, read with `useQuery`
- **Runtime lifetime.** A live resource runtime belongs to
  [the register](../resource-runtimes/resource-runtimes.md). Nothing here
  attaches or releases one

## A key is a path

`"project.variables"` is `context/project/variables.svelte`.
`"collaboration.person"` is `inspector/collaboration/person.svelte`. The
`research` screen's `"one-question"` is
`workspaces/research/workspace-one-question.svelte`.

The vocabulary in [`methods/shared/keys.ts`](methods/shared/keys.ts) is
**generated** from the trees by `pnpm view-state-keys`, and
`pnpm view-state-keys -- --check` exits non-zero when the file and the trees
disagree. A key that names nothing does not compile, and it cannot drift.

`"empty"` is the one member that is not generated: nothing selected is a state
the application has, not a file in the tree, so it is unioned in by hand as
`Inspected`.

**An inspection key never carries a payload.** It is a namespaced label and
nothing more; what it is about lives in `selection`, once. The two were one field
before — `block.text-selection` held `{ blockId, from, to }` — and that was a
second record of what the user had selected, beside the one already in view
state.

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, after the workbench
- **Released by:** nothing — it holds nothing releasable

**Nothing here is persisted.** The constructor takes only the project, so there
is no restore path, no stored shape and no read that reports a default it never
stored. The seven singleton tabs are built rather than restored, which is what
makes "`activeId` names a real tab, always" an invariant rather than a hope.

## Public Methods

Every method on `ViewStateModel`. **Shape** records the choice made when the
method was added: a file while one file tells the truth, a directory once it owns
supporting flow. Every one is still a file.

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `open` | file | mutator | Open a target, or activate the tab already on it |
| `activate` | file | mutator | Move to a tab |
| `close` | file | mutator | Close a tab and remember it; throws for a singleton |
| `reopenClosed` | file | mutator | Put back the most recently closed tab, with the state it had |
| `showSubscreen` | file | mutator | Switch which centre this screen is showing |
| `selectContext` | file | mutator | Move the rail |
| `inspect` | file | mutator | Open a lens, and record what it is about |
| `clear` | file | mutator | Nothing selected |
| `resize` | file | mutator | Record a drag |
| `showing` | none | accessor | Whether the active tab is on a given centre right now |

A simple method has no document of its own.
[`methods/methods.md`](methods/methods.md) lists them.

`showing` is answered in the definition rather than in `methods/`. It compares
two fields on the active tab and calls nothing, and the code gives no reason for
the departure; the standard would put it in `methods/` with the rest.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `project` | `readonly string` | The project this instance acts on. Read from the route once |
| `tabs` | `readonly Tab[]` | Singletons first, then what the person opened, in their order |
| `activeId` | `readonly TabId` | Which tab everything else is about |
| `closed` | `readonly Tab[]` | The reopen queue, newest first, capped at ten. Whole tabs, not identities |
| `active` | `readonly Tab` | Never undefined: a singleton cannot be closed, so one always remains |
| `frame` | `readonly Frame` | The active tab's panel geometry — two widths, two collapse flags |
| `context` | `readonly ContextId \| undefined` | The rail position, or this subscreen's default if it has drifted |
| `inspected` | `readonly Inspected` | Which lens, or `"empty"` |
| `selection` | `readonly Selection \| undefined` | What the lens is about |

The last five read the active tab, so a tab switch changes all of them at once
and no surface has to be told.

**`context` is derived rather than stored.** A subscreen change cannot leave the
panel pointing at a view its rail no longer offers, even if nothing reset it.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable without
a DOM.

## Construction

```ts
export const createViewState = (project: string): ViewStateModel => ...;
```

Every call returns a fresh object, with its seven permanent tabs already open.
Ids are per instance and never persisted, so a counter on the instance is enough;
nothing lives at module scope.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| — | — | None. It borrows no object |

**It borrows nothing**, and that is a statement about the graph rather than an
omission: what is open and what is being looked at is decided by the person, not
by anything else in the model, which is why this takes only the project and why
it could be built first. It is built after the workbench in
[`buildClientModel`](../constructor.ts) to keep the reading order of that function
the order the objects were added in. The dependency runs the other way — the
copilot borrows an object of this shape, and is handed the workbench today.

## Terminal Behaviour

None. It holds nothing releasable, so `ClientModel.close()` passes it by. What is
open is not a resource; the resource runtimes behind a tab are, and they are a
different object with a different lifetime.

## Concurrency and SSR

- Every method is synchronous and nothing awaits, so no two can interleave.
- **The model never calls a capability.** It is testable without a network.
- **It touches no browser API** — no storage, no timers, no `window`. The root's
  `browser` guard is therefore not load-bearing for this object's own behaviour;
  it is load-bearing for reaching it, because `clientModel()` refuses on the
  server. That distinction is the whole of the open question below.

## Invariants

- **`activeId` names a real tab, always.** The singleton set is built in the
  constructor and cannot be closed, so there is always something to fall back to.
- **One identity function.** `targetKey` is the whole definition of "already
  open", and `mintTab` is the only place a tab is minted.
- **Every key names a file.** The vocabulary is generated from the trees and
  `--check` fails when the two disagree.
- **An inspection key never carries a payload.** The selection lives once, beside
  it.
- **Permanence is derived, not stored:** `SINGLETONS.includes(tab.screen)`.
- **The rail position is one this subscreen offers**, or that subscreen's
  default. `undefined` only where the subscreen has no rail at all, which is a
  real state rather than a gap.
- **A subscreen is view state, never a second tab.** Research on one question and
  Research on every thread are one tab in two states.
- **`resize` cannot reach `contextId`.** A drag can never move the rail and a
  rail click can never resize a panel, structurally rather than by convention.
- **The model holds values; views hold bounds.**
- **No component type enters the model.** The `view-keys` rule enforces it.
- **Nothing here is persisted.**

## Not settled: how a panel reaches this object

The 197 panels do not read this object. They read a module singleton,
`mockWorkbench` from
[`$mock-models/workbench.svelte`](../../../mock-models/workbench.svelte.ts) — 181
of them import it today — and **that is what lets every one of them render on its
own.** [`src/lib/independence.test.ts`](../../../independence.test.ts) proves it:
each panel is rendered through `svelte/server` with nothing but a permissive prop
bag, and one that reached for something it should not have throws.

Routing them through `clientModel().viewState` would break that. `clientModel()`
refuses on the server, and `render()` from `svelte/server` runs in Node.

Three candidate answers:

1. **Panels read `clientModel().viewState`.** The independence test weakens from
   "every panel renders on its own" to "every panel module loads".
2. **Panels read it from Svelte context, with a fallback.** Standalone rendering
   survives, at the cost of a second way in.
3. **The mock stays** until the shell rewiring swaps them together, in one
   change.

None is chosen.

## File Tree

```text
view-state/
├── view-state.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
└── methods/
    ├── methods.md
    ├── open.ts · activate.ts · close.ts · reopen-closed.ts
    ├── show-subscreen.ts · select-context.ts
    ├── inspect.ts · clear.ts · resize.ts
    └── shared/
        ├── shared.md
        ├── keys.ts · rails.ts
        └── mint-tab.ts · target-key.ts
```

There is no `test/` yet.

Two modules under `methods/shared/` are not methods: `keys.ts` is a generated
vocabulary and `rails.ts` is a map transcribed from the specifications. Both sit
there rather than at the object root because the root holds what this object
**is** — its document, its door, its types, its state and its constructor — and
`lint:model` admits nothing else.
[`methods/shared/shared.md`](methods/shared/shared.md) names the callers each
serves.

## Supporting Documents

None. This object has no `docs/`.
