# View State

Lives at the object root as `view-state.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

View state holds **what a person has open, and what they are looking at inside
it**, for the four panel trees: `context/` (92 views), `inspector/` (107 lenses,
and the tree is still being filled in), `workspaces/` (13 centres over 9 screens)
and `modals/`.

One object, and the five shell surfaces are functions of it — the tab strip, the
context panel, the centre, the inspector and the status bar own almost nothing
between them and write back only through these methods. There is no event bus, no
store subscription and no surface-to-surface communication: the state is `$state`
and Svelte's reactivity is the whole delivery mechanism, and the case for that is
set out in
[the workbench design record](../../../../../../docs/client-model/workbench.md).

## Why this is its own object and not a wider workbench

The two answer the same three questions, and they cannot be one object because
they disagree about what a key *is*. The workbench types a context id and an
inspection key as a bare `string` — an opaque label it remembers per tab and
never interprets, so the view that renders the rail decides what it means. This
object types both as unions generated from the trees, which is what makes a key
naming no file a compile error.

One vocabulary cannot be both. Widening these back to `string` gives that up for
every panel in the four trees; narrowing the workbench's is a rewrite of
everything that reads it rather than an edit. So the workbench keeps what still
speaks its own vocabulary — `commands`, `copilot`, and the stored shape in
`storage` — and this holds the trees. [`ClientModel`](../types.ts) records the
same division at the field.

**What the two share, deliberately:** permanent tabs that are one per project and
always open; permanence derived rather than stored; one identity function
deciding "already open"; the reopen queue holding whole tabs; the two asymmetries
around the rail; the model holding values while views hold bounds; and no
component type entering the model. These are the parts of the design that are
about tabs rather than about vocabularies, and neither object has a reason to
answer them differently.

**What is particular to this one:** the subscreen, as a first-class part of what
a tab is; a key vocabulary generated from the trees rather than hand-written in
`views/`; the selection kept once, beside the inspection key rather than inside
it; a tab that knows what its centre is *about*; and no persistence at all — this
object takes no storage, so it has no `PERSISTED_FIELDS`.

## Four tabs are places, and everything else is a thing

The permanent tabs are Overview, Analysis, Templates and Agents. Each is somewhere
the project's work of one kind is gathered, and somewhere you *return* to rather
than arrive at. Not being on one *is* closing it, so `close` refuses them.

A screen that holds one identified thing at a time is not a place. It is a tab
keyed by that thing, and Research is the case that draws the line: a line of
enquiry is opened, worked in and closed, so each thread is its own tab keyed by
its `resourceId`, exactly as a document is keyed by the document. Two threads are
two tabs in the strip, each with its own rail position and its own inspection;
one thread reached from a finding, from a mention and from the thread library is
one tab, in the state the person left it. The `library.threads` context view is
the map onto them, which is why it sits on the thread's own rail: you get to
another thread from the one you are in.

The rejected alternative is a permanent Research screen with the threads inside
it. It fails on what a tab strip is *for*: closing the last thread would have to
either close a permanent screen or leave an editor open on nothing, and the strip
would stop being the answer to "what am I working on".

## Navigation is selection-driven

**There is no subscreen switcher.** You get to a persona by choosing a persona;
the double click that chooses it is the same call that switches the centre, and
you come back with the back button the centre's own bar draws. That is why
`showSubscreen` takes what the centre is about as its second argument, and why
passing nothing is how a library is returned to.

The alternative — picking a centre from the panel and then picking a thing inside
it — makes "which centre" and "which thing" two acts, and the second one can be
skipped. An editor open on nothing is the state that produces.

The consequence for this object is `Tab.focus`. It cannot be `resourceId`: that
is fixed at mint and is what makes two documents two tabs, while a permanent tab
is one tab that moves between subjects all day. It cannot be `selection` either:
`selection` is what has been picked out *inside* the centre and is what the
inspector is about. A persona is in focus while a tool in its list is selected —
two questions, and each field answers one.

## Ownership Boundary

View state owns:

- What is open, in what order, and which one is active
- Everything a tab carries: its screen and subscreen, the resource it is for, its
  rail position, what its centre is about, its inspection, its selection and its
  frame
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
`"collaboration.person"` is `inspector/collaboration/person.svelte`. The `agents`
screen's `"persona"` is `workspaces/agents/workspace-persona.svelte`.

The vocabulary in [`methods/shared/keys.ts`](methods/shared/keys.ts) is
**generated** from the trees by `pnpm view-state-keys`, and
`pnpm view-state-keys -- --check` exits non-zero when the file and the trees
disagree. A key that names nothing does not compile, and it cannot drift.

`"empty"` is the one member that is not generated: nothing selected is a state
the application has, not a file in the tree, so it is unioned in by hand as
`Inspected`.

**An inspection key never carries a payload.** It is a namespaced label and
nothing more; what it is about lives in `selection`, once. A key that carried
`{ blockId, from, to }` would be a second record of what the user has selected,
beside the one already in view state, and two records of one thing disagree.

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`
- **Released by:** nothing — it holds nothing releasable

**Nothing here is persisted.** The constructor takes only the project, so there
is no restore path, no stored shape and no read that reports a default it never
stored. The permanent tabs are built rather than restored, which is what
makes "`activeId` names a real tab, always" an invariant rather than a hope.

## Public Methods

Every method on `ViewStateModel`. **Shape** records the choice made when the
method was added: a file while one file tells the truth, a directory once it owns
supporting flow. Every one is still a file.

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `open` | file | mutator | Open a target, or move the tab already on it to what the target asked for |
| `activate` | file | mutator | Move to a tab |
| `close` | file | mutator | Close a tab and remember it; throws for a permanent screen |
| `reopenClosed` | file | mutator | Put back the most recently closed tab, with the state it had |
| `showSubscreen` | file | mutator | Switch which centre this screen is showing, and say what it is about |
| `selectContext` | file | mutator | Move the rail |
| `inspect` | file | mutator | Open a lens, and record what it is about |
| `clear` | file | mutator | Nothing selected |
| `resize` | file | mutator | Record a drag |
| `showing` | file | accessor | Whether the active tab is on a given centre right now |

A simple method has no document of its own.
[`methods/methods.md`](methods/methods.md) lists them.

`showing` is the only accessor among the ten, and it has a file like the rest of
them: the definition being one call per method is what keeps that class readable,
so a body doing its own work there would be the one place a reader has to stop.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `project` | `readonly string` | The project this instance acts on. Read from the route once |
| `tabs` | `readonly Tab[]` | The permanent tabs first, then what the person opened, in their order |
| `activeId` | `readonly TabId` | Which tab everything else is about |
| `closed` | `readonly Tab[]` | The reopen queue, newest first, capped at ten. Whole tabs, not identities |
| `active` | `readonly Tab` | Never undefined: a permanent tab cannot be closed, so one always remains |
| `frame` | `readonly Frame` | The active tab's panel geometry — two widths, two collapse flags |
| `context` | `readonly ContextId \| undefined` | The rail position, or this subscreen's default if it has drifted |
| `inspected` | `readonly Inspected` | Which lens, or `"empty"` |
| `selection` | `readonly Selection \| undefined` | What the lens is about |

The last five read the active tab, so a tab switch changes all of them at once
and no surface has to be told.

**`focus` is deliberately not promoted to the top level** the way `context` and
`inspected` are. Those are read by surfaces that are about the shell — the rail,
the inspector, the resizers — and every screen reads them. What a centre is about
is read by that one centre, which already has `active` in hand, and a shortcut on
the model would suggest the shell knows what it means.

**`context` is derived rather than stored.** A subscreen change cannot leave the
panel pointing at a view the new rail does not offer, even if nothing reset it.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable without
a DOM.

## Construction

```ts
export const createViewState = (project: string): ViewStateModel => ...;
```

Every call returns a fresh object, with its three permanent tabs already open —
Overview, Templates and Agents. Ids are per instance and never
persisted, so a counter on the instance is enough; nothing lives at module scope.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| — | — | None. It borrows no object |

**It borrows nothing**, and that is a statement about the graph rather than an
omission: what is open and what is being looked at is decided by the person, not
by anything else in the model, which is why this takes only the project. Its
position in [`buildClientModel`](../constructor.ts) is therefore a reading order
and not a constraint — it would be just as correct first. Every dependency runs
the other way, from the objects that read a tab towards this one.

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
  server. That distinction is why a panel reads this through context rather than
  through the root.

## Invariants

- **`activeId` names a real tab, always.** The permanent tabs are built in the
  constructor and cannot be closed, so there is always something to fall back to.
- **One identity function.** `targetKey` is the whole definition of "already
  open", and `mintTab` is the only place a tab is minted.
- **Every key names a file.** The vocabulary is generated from the trees and
  `--check` fails when the two disagree.
- **An inspection key never carries a payload.** The selection lives once, beside
  it.
- **Permanence is derived, not stored:** `SINGLETONS.includes(tab.screen)`.
- **`resourceId` is fixed at mint and `focus` is writable.** What a tab is *for*
  cannot change; what its centre is *about* changes all day.
- **The rail position is one this subscreen offers**, or that subscreen's
  default. `undefined` only where the subscreen has no rail at all, which is a
  real state rather than a gap.
- **A subscreen is view state, never a second tab.** Agents on a persona and
  Agents on the library it was chosen from are one tab in two states.
- **A centre change takes its rail and its inspection with it.**
  [`landOn`](methods/shared/land-on.ts) is the single path, so a tab reached from
  another screen lands in exactly the state it would have reached by hand.
- **`resize` cannot reach `contextId`.** A drag can never move the rail and a
  rail click can never resize a panel, structurally rather than by convention.
- **The model holds values; views hold bounds.**
- **No component type enters the model.** The `view-keys` rule enforces it.
- **Nothing here is persisted.**

## How a panel reaches this object

Through Svelte context, from [`index.ts`](index.ts):

```ts
const view = viewState();
```

The shell provides the instance the client graph built; a review page provides
one of its own; a panel with no provider gets one to itself.

**That last clause is the whole reason it is context rather than
`clientModel()`.** Every panel in the four trees renders on its own, and
[`src/lib/independence.test.ts`](../../../independence.test.ts) proves it by
server-rendering each with nothing but a permissive prop bag. `clientModel()`
refuses outside a browser and before the layout has run, so routing panels
through it would end that for every one of them.

The fallback is per reader rather than a module singleton: two panels rendered
with no provider between them are two unrelated things, and one shared object
would make a stray click in one move the other.

**It must be read during initialisation**, like any context. A component that
calls `viewState()` inside an event handler gets the fallback instead of the
shell's instance, which is the one way to misuse this — read it once at the top
and hold it.

## File Tree

```text
view-state/
├── view-state.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── open.ts · activate.ts · close.ts · reopen-closed.ts
│   ├── show-subscreen.ts · select-context.ts · showing.ts
│   ├── inspect.ts · clear.ts · resize.ts
│   └── shared/
│       ├── shared.md
│       ├── keys.ts · rails.ts
│       └── land-on.ts · mint-tab.ts · target-key.ts
└── test/unit/view-state.test.ts
```

Two modules under `methods/shared/` are not methods: `keys.ts` is a generated
vocabulary and `rails.ts` is a map transcribed from the specifications. Both sit
there rather than at the object root because the root holds what this object
**is** — its document, its door, its types, its state and its constructor — and
`lint:model` admits nothing else.
[`methods/shared/shared.md`](methods/shared/shared.md) names the callers each
serves.

## Supporting Documents

None. This object has no `docs/`.
