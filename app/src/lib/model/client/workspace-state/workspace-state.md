# Workspace State

Lives at the object root as `workspace-state.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

Workspace state holds **what a person has open, and what they are looking at inside
it**, for the four panel trees: `context/` (92 views), `inspector/` (107 lenses,
and the tree is still being filled in), `workspaces/` (13 centres over 9 categories)
and `modals/`.

One surface, and the five shell surfaces are functions of it — the tab strip, the
context panel, the centre, the inspector and the status bar own almost nothing
between them and write back only through these methods. There is no event bus, no
store subscription and no surface-to-surface communication: the state is `$state`
and Svelte's reactivity is the whole delivery mechanism.

## Three objects behind one surface

The state itself is two halves that were written apart six times over before they
were separated: every method that touched what a tab is *showing* opened with
`const tab = state.active`, and no list method touched anything but `activeId`.

```text
tab-list  ──────►  workspace-state  ◄──────  tab-views
what exists        coordinator               what each tab
the order          the composition           is looking at
which is active    the only writer
```

[`tab-list`](../tab-list/tab-list.md) holds `TabRecord`s — an id, a category and
the resource a tab is *for*. [`tab-views`](../tab-views/tab-views.md) holds one
`TabView` per id, keyed by nothing else. Neither knows the other exists, and
neither decides anything: `tab-views` writes the fields it is told to write, and
the policy behind them — which rail a centre offers, what a landing clears, what
a new tab starts as — is this object's.

**A `Tab` is a composition rather than a record**, which is what lets the two
halves be owned separately and what keeps this object's surface unchanged from
when it was one class. `compose` is where the stored `null`s become the
`undefined`s the view tree reads.

**The two collaborators are not fields on `ClientModel`.** Every other model
object is; these two are handed to the constructor and never returned, because a
view reaching `tabList.add(...)` through the graph would move a tab without going
through here — and going through here is the whole point.

## Three tabs are places, and everything else is a thing

The permanent tabs are Overview, Agents and Templates. Each is somewhere
the project's work of one kind is gathered, and somewhere you *return* to rather
than arrive at. Not being on one *is* closing it, so `close` refuses them.

A category that holds one identified thing at a time is not a place. It is a tab
keyed by that thing, and Research is the case that draws the line: a line of
enquiry is opened, worked in and closed, so each thread is its own tab keyed by
its `resourceId`, exactly as a document is keyed by the document. Two threads are
two tabs in the strip, each with its own rail position and its own inspection;
one thread reached from a finding, from a mention and from the thread library is
one tab, in the state the person left it. The `library.threads` context view is
the map onto them, which is why it sits on the thread's own rail: you get to
another thread from the one you are in.

The rejected alternative is a permanent Research category with the threads inside
it. It fails on what a tab strip is *for*: closing the last thread would have to
either close a permanent category or leave an editor open on nothing, and the strip
would stop being the answer to "what am I working on".

## Navigation is selection-driven

**There is no centre switcher.** You get to a persona by choosing a persona;
the double click that chooses it is the same call that switches the centre, and
you come back with the back button the centre's own bar draws. That is why
`showContent` takes what the centre is about as its second argument, and why
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

Workspace state owns:

- **The composition.** A `Tab` is a record and a view read together, and this is
  the only place they meet
- **Every write.** Both collaborators are private to it, so a tab changes here or
  it does not change
- **The log.** Every gesture is one or two `WorkspaceOp`s, recorded before the method
  returns, and undo is that log read backwards
- **The rail map** — which context views each category offers, and which centre
  it opens on
- **What a new tab starts as** — which categories are permanent, and the frame every
  tab is minted with

`tab-list` owns what exists, in what order, and which one is active. `tab-views`
owns what each tab is looking at. Neither owns a decision.

Consumers own:

- **Which component a key resolves to.** This object publishes stable keys; the
  four trees hold the files, and the resolution is the shell's
- **Bounds.** The model records a width; the panel that enforces the drag knows a
  minimum, a maximum and a collapse threshold
- **Everything stored.** A tab is client state; a document, a person, a finding
  are rows, read with `useQuery`
- **Runtime lifetime.** A live resource runtime belongs to the register for its
  kind — [documents](../document-runtimes/document-runtimes.md),
  [slide decks](../slide-deck-runtimes/slide-deck-runtimes.md) or
  [spreadsheets](../spreadsheet-runtimes/spreadsheet-runtimes.md). Nothing here
  attaches or releases one

## A key is a path

`"analysis.fields"` is the `fields` leaf of `analysis`'s `context/`, and
`"general.person"` is the `person` view under `general/`. A centre is keyed the
same way: `"agents.persona"` is
[`app-views/categories/agents/content/persona.svelte`](../../../app-views/categories/agents/content/persona.svelte).

The vocabulary is the `workspace` domain's, under `representation/`: the unions in
`data/types/workspace/`, their lists and guards in `data/behavior/workspace/`. Categories
are **generated** from the workspace tree by `pnpm category-keys`, and
`pnpm category-keys -- --check` exits non-zero when the files and the tree
disagree. A key that names nothing does not compile, and it cannot drift.

`"empty"` is the one member that is not generated: nothing selected is a state
the application has, not a file in the tree, so it is unioned in by hand as
`Inspected`.

**An inspection key never carries a payload.** It is a namespaced label and
nothing more; what it is about lives in `selection`, once. A key that carried
`{ blockId, from, to }` would be a second record of what the user has selected,
beside the one already in workspace state, and two records of one thing disagree.

## Every gesture is an operation

A method here does not write state. It reads the `was` half off the tab, builds a
`WorkspaceOp`, and hands it to `perform`, which applies it and appends it to the log.
Seven members cover everything a person can do to what is open, and every one
carries both sides of what it changed — so `invert` is a payload swap that reads
no state, and undo is an ordinary change rather than a rewind.

**`open` and `close` are exact mirrors, and neither moves the cursor.** Opening a
tab is `open` followed by `activate`; closing the active one is `activate`
followed by `close`. Splitting the move out is what makes the pair invertible: a
`close` that chose its own neighbour would be an effect with nothing in the op to
undo it from, and the tab you were on before would be unrecoverable.

**The reopen queue is gone.** `close` used to push a whole `Tab` onto a ten-deep
array that existed so one operation could be undone, special-cased. Now
`reopenClosed` and `undo` are two readers of one structure:

| Call | Is |
| --- | --- |
| `reopenClosed()` | the most recent `close` with no later `open` for that tab, inverted |
| `undo()` | the most recent op of any kind, inverted |

Reopening is itself recorded, which is what makes "each close comes back once"
true without a second list to cross off.

**A new gesture drops the redo stack.** Replaying an op against a state it was
never authored over is the one way this produces a tab nobody put there.

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`
- **Released by:** nothing — it holds nothing releasable

**Nothing here is persisted yet.** There is no restore path and no read that
reports a default it never stored. The permanent tabs are built rather than
restored, which is what makes "`activeId` names a real tab, always" an invariant
rather than a hope. The stored shape now exists — the `workspace` domain's
`workspaceSnapshots` and `workspaceRevisions`.

## Public Methods

Every method on `WorkspaceStateModel`. **Shape** records the choice made when the
method was added: a file while one file tells the truth, a directory once it owns
supporting flow. Every one is still a file.

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `open` | file | mutator | Open a target, or move the tab already on it to what the target asked for |
| `activate` | file | mutator | Move to a tab |
| `close` | file | mutator | Close a tab and remember it; throws for a permanent category |
| `reopenClosed` | file | mutator | Put back the most recently closed tab, with the state it had |
| `showContent` | file | mutator | Switch which centre this category is showing, and say what it is about |
| `selectContext` | file | mutator | Move the rail |
| `inspect` | file | mutator | Open a lens, and record what it is about |
| `clear` | file | mutator | Nothing selected |
| `resize` | file | mutator | Record a drag |
| `showing` | file | accessor | Whether the active tab is on a given centre right now |
| `undo` | file | mutator | Apply the inverse of the last op, and keep it for `redo` |
| `redo` | file | mutator | Apply the last undone op again |

A simple method has no document of its own.
[`methods/methods.md`](methods/methods.md) lists them.

`showing` is the only accessor among the twelve, and it has a file like the rest
of them: the definition being one call per method is what keeps that class readable,
so a body doing its own work there would be the one place a reader has to stop.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `project` | `readonly string` | The project this instance acts on. Read from the route once |
| `tabs` | `readonly Tab[]` | The permanent tabs first, then what the person opened, in their order |
| `activeId` | `readonly TabId` | Which tab everything else is about |
| `active` | `readonly Tab` | Never undefined: a permanent tab cannot be closed, so one always remains |
| `frame` | `readonly Frame` | The active tab's panel geometry — two widths, two collapse flags |
| `context` | `readonly ContextId \| undefined` | The rail position, or this category's default if it has drifted |
| `inspected` | `readonly Inspected` | Which lens, or `"empty"` |
| `selection` | `readonly Selection \| undefined` | What the lens is about |
| `canUndo` | `readonly boolean` | Whether the log has anything in it |
| `canRedo` | `readonly boolean` | Whether anything has been undone and not replaced |

Five of these read the active tab, so a tab switch changes all of them at once
and no surface has to be told.

**`focus` is deliberately not promoted to the top level** the way `context` and
`inspected` are. Those are read by surfaces that are about the shell — the rail,
the inspector, the resizers — and every category reads them. What a centre is about
is read by that one centre, which already has `active` in hand, and a shortcut on
the model would suggest the shell knows what it means.

**`context` is derived rather than stored.** A position written in from outside
cannot leave the panel pointing at a view the rail does not offer.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable without
a DOM.

## Construction

```ts
export const createWorkspaceState = (
  project: string,
  tabs: TabListModel,
  views: TabViewsModel
): WorkspaceStateModel => ...;
```

Every call returns a fresh object, with its three permanent tabs already open —
Overview, Agents and Templates. Ids are per instance and never persisted, so a
counter on `tab-list` is enough; nothing lives at module scope.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `tabs` | BORROWED | What exists, in what order, and which one is active |
| `views` | BORROWED | One `TabView` per tab id |

Both are constructed by [`buildClientModel`](../../../runtime/client/start.ts)
immediately above this one and handed in, because the model standard is that the
runtime holds every instance. Neither is returned in the graph it builds: this
object is the only reader either has.

Nothing else in the model is borrowed. What is open and what is being looked at
is decided by the person, so every other dependency runs the other way, from the
objects that read a tab towards this one.

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
  open"; `tab-list.mint` is the only place a record is minted and `mintView` the
  only place a view is.
- **One writer.** Both collaborators are private, so nothing changes a tab
  without passing through a method here — which is what makes the log complete.
- **Every op is closed under inversion.** `invert` is a payload swap that reads
  no state, so undo is an ordinary change rather than a rewind.
- **Every key names a file.** The vocabulary is generated from the trees and
  `--check` fails when the two disagree.
- **An inspection key never carries a payload.** The selection lives once, beside
  it.
- **Permanence is derived, not stored:** `SINGLETONS.includes(tab.category)`.
- **`resourceId` is fixed at mint and `focus` is writable.** What a tab is *for*
  cannot change; what its centre is *about* changes all day.
- **The rail position is one this category offers**, or that category's
  default. `undefined` only where the category has no rail at all, which is a
  real state rather than a gap.
- **A centre is workspace state, never a second tab.** Agents on a persona and
  Agents on the library it was chosen from are one tab in two states.
- **A centre change takes its inspection with it and leaves the rail alone.**
  [`landOn`](methods/shared/land-on.ts) is the single path, so a tab reached from
  another category lands in exactly the state it would have reached by hand.
- **`resize` cannot reach `contextId`.** A drag can never move the rail and a
  rail click can never resize a panel, structurally rather than by convention.
- **The model holds values; views hold bounds.**
- **No component type enters the model.** The `view-keys` rule enforces it.
- **Nothing here is persisted.**

## How a panel reaches this object

Through Svelte context, from [`index.ts`](index.ts):

```ts
const view = workspaceState();
```

The shell provides the instance the client graph built; a review page provides
one of its own; a panel with no provider gets one to itself.

**That last clause is the whole reason it is context rather than
`clientModel()`.** `clientModel()` refuses outside a browser and before the
layout has run, so a view reaching through it could only ever be drawn by the
running application — no review page, no test, and nothing that renders one on
its own. Context has a fallback; the graph does not.

The fallback is per reader rather than a module singleton: two panels rendered
with no provider between them are two unrelated things, and one shared object
would make a stray click in one move the other.

**It must be read during initialisation**, like any context. A component that
calls `workspaceState()` inside an event handler gets the fallback instead of the
shell's instance, which is the one way to misuse this — read it once at the top
and hold it.

## File Tree

```text
workspace-state/
├── workspace-state.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── open.ts · activate.ts · close.ts · reopen-closed.ts
│   ├── show-content.ts · select-context.ts · showing.ts
│   ├── inspect.ts · clear.ts · resize.ts
│   ├── undo.ts · redo.ts
│   └── shared/
│       ├── shared.md
│       ├── defaults.ts · rails.ts
│       ├── apply.ts · perform.ts · landing.ts
│       └── compose.ts · land-on.ts · mint-view.ts · target-key.ts
└── test/unit/
    ├── workspace-state.test.ts
    ├── persistence.test.ts
    └── invert.test.ts
```

Two modules under `methods/shared/` are not methods: `defaults.ts` says what a
tab starts as and `rails.ts` is a map transcribed from the specifications. Both
sit there rather than at the object root because the root holds what this object
**is** — its document, its index, its types, its state and its constructor — and
`lint:model` admits nothing else.
[`methods/shared/shared.md`](methods/shared/shared.md) names the callers each
serves.

## Supporting Documents

None. This object has no `docs/`.
