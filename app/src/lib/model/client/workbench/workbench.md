# Workbench

Lives at the object root as `workbench.md`. It is the entry point: a reviewer
reads this, then follows the file tree into the document that answers their
question.

## Description

The workbench holds **every tab and everything a tab is**. The tab strip, context
panel, work surface, inspector and status bar read it directly and write back
through its methods.

There is no event bus, no store subscription, no props drilling, and no
surface-to-surface communication — the model is `$state` and Svelte's reactivity
is the whole delivery mechanism. That is why the five shell surfaces own almost
nothing between them, and why a screen can be built without touching any of them.

Three things that were once separate objects fold in here: the context rail, the
inspector, and panel geometry. All three read and wrote the active tab, and being
handed a workbench at construction was the tell.

**One thing folds back out.** A live resource runtime was a field on `Tab`, and
it belongs to one of three registers now —
[documents](../document-runtimes/document-runtimes.md),
[slide decks](../slide-deck-runtimes/slide-deck-runtimes.md) and
[spreadsheets](../spreadsheet-runtimes/spreadsheet-runtimes.md).

## Ownership Boundary

The workbench owns:

- What is open, in what order, and which one is active
- Everything a tab carries: its target, its typed view state, its frame, its
  inspection key
- The reopen queue
- **Runtime lifetime** — it attaches when a resource tab opens and releases when
  one closes

Consumers own:

- **Every vocabulary.** Which contexts a screen offers, what an inspection key
  means, which component a screen kind renders as — all `views/`
- **Bounds.** The model records a width; the panel that enforces the drag knows a
  gesture overshot
- **Everything stored.** A tab is client state; a document, a persona, an
  activity are rows, read with `useQuery`

## Three kinds of tab

Identity is the only axis a target expresses.

```ts
type TabTarget =
  | { kind: "singleton"; screen: SingletonScreen }
  | { kind: "resource"; resourceType: GeneralResourceType; resourceId: string }
  | { kind: "launcher" };
```

**Singletons** are one per project and always open: project overview, research,
analysis, context, templates, personas, automations. **Resources** are the three
bodies `revisions` edits. **Launchers** have no identity at all.

Research and analysis are singletons rather than id-bearing tabs, and that is the
correction worth stating plainly: each has its own internal selection — an
investigation, an analysis — exactly as a deck selects a slide. That belongs in
view state. A tab per investigation would make the strip the navigation for a
screen that already has its own.

### `permanent` is derived, not stored

Every singleton is permanent, so permanence is not an independent fact about a
tab — it is `target.kind === "singleton"`, and `isPermanent(tab)` is the one
spelling of it. A boolean beside the target would be a second answer that can
disagree with the first.

Five surfaces ask: `close` and `reorder` refuse one, `closeAll` keeps only
those, the strip offers no close affordance for one, and the `tab.close`
command greys itself out on one.

### The launcher never dedupes

`targetKey()` answers "is this already open", and a launcher has no identity, so
it returns `undefined` and a fresh tab is minted whenever the key is absent. Open
five, get five. It is otherwise an ordinary tab, with a context panel and
inspector of its own.

## State

| Field | Type | Persisted |
| --- | --- | --- |
| `tabs` | `readonly Tab[]` | not yet |
| `activeId` | `TabId` | not yet |
| `closed` | `readonly Tab[]` | never |

`tabs` holds singletons first, then closable tabs in user order. `activeId` is
never empty, because a singleton cannot be closed and one therefore always
remains — an invariant rather than a hope. `closed` is the reopen queue, capped at
ten, holding **whole tabs** so that a reopen restores view state rather than just
identity.

## Two labels the model never reads

`frame.contextId` and `Tab.inspected` are both opaque strings.

This is the decision that lets the workbench stand on its own. A `CONTEXT_IDS`
union with a `Record<ScreenKind, …>` beside it would grow a member every time a
screen arrived, so a model type would be edited by the arrival of a screen it
knows nothing about.

The inspector's answer serves both: a key, routed on its prefix by the panel that
renders it. The rail's vocabulary and its drift fallback therefore belong to
[`views/context-panel/procedures/`](../../../views/context-panel/procedures/procedures.md),
and neither `availableContexts` nor `activeContext` is on this object.

What it costs: `selectContext` cannot refuse an id the rail never offered, because
there is no rail here to check against. The panel resolves an unknown one to its
own default, which is where the knowledge to do that lives — and that fallback is
unit-tested there, in `procedures/`, rather than being untestable in markup.

## `viewState`

The screen's whole typed working state, one arm per screen kind. Not the selected
context — that is one field, two levels down, in `frame`.

Called `viewState` and not `state` because four different things in this object
are state, and the ambiguity cost more than the four extra characters.

`frame` is the shell's own per-tab geometry. Every member is present from the
moment a tab is minted except `contextId`, and that one is genuinely absent
rather than defaulted: which context a screen starts on is the panel's knowledge,
so absent means "the panel's default", which is the only answer this object could
honestly give.

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `open` | directory | mutator | The tab already on this target, or a fresh one |
| `resolveLauncher` | directory | mutator | Turn a launcher into what it created |
| `close` | file | mutator | Throws for a singleton |
| `closeAll` | file | mutator | Clear to the singletons; releases everything |
| `activate` | file | mutator | Throws for an id that names nothing |
| `reorder` | file | mutator | Closable tabs only; clamps rather than throwing |
| `reopenClosed` | file | mutator | The last closed tab, with its view state |
| `update` | file | mutator | Patch one screen's own state, kind restated |
| `selectContext` | file | mutator | Record the rail position |
| `inspect` | file | mutator | Replace the inspection key |
| `resize` | file | mutator | Frame values only; cannot reach `contextId` |
| `inspectedNode` | file | accessor | The active tab's key |
| `frame` | file | accessor | The active tab's geometry |
| `runtimeFor` | file | accessor | The only route from a view to a runtime |

Fourteen, and the boundaries they draw are as much a part of the surface as the
methods themselves. Runtime attachment and retirement belong to the register;
which contexts a rail offers belongs to the context panel; multiple selection
waits on the strip having a drag gesture to select with.

`assignState` is not a public method and should not become one. It is the
procedure in `methods/shared/` that `update`, `resize` and `selectContext` route
through.

### Two asymmetries that are deliberate

`update` throws when the restated kind does not match the tab; `reorder` clamps
an out-of-range index. A caller naming the wrong screen is a defect — that is
exactly the case a cast would have let through silently — where a drag that
overshoots the end of the strip means the end.

`resize` records values only and **cannot reach `contextId`**, because the patch
type excludes it. So a drag can never move the rail and a rail click can never
resize a panel, structurally rather than by convention.

## Construction

```ts
export const createWorkbench = (runtimes: ResourceRuntimesModel): WorkbenchModel => ...;
```

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `runtimes` | BORROWED | `attach` on open, `release` on close; never disposed here |

It builds the singletons in its constructor rather than restoring them, which is
what makes "`activeId` is never empty" an invariant rather than a hope. They are
minted through `adoptTarget` like every other tab, so nothing about them is a
special case beyond being built first.

**No storage, yet.** See below.

## Terminal Behaviour

- **Terminal operation:** `closeAll`, reached from `ClientModel.close()`
- **Releases:** every runtime, through `releaseAll`
- **After release:** the singletons remain and the object is still usable — this
  is a clear, not a close

`close(id)` splices from `tabs`, pushes the whole tab onto `closed`, and for a
resource target calls `release`. **Release at close, not at dequeue:** release is
the flush, and a closed tab holding an unflushed buffer would mean the user's
last edits sit unsent until ten unrelated tabs close. The queue still holds the
whole tab, so a reopen restores zoom, find query, rail position and panel widths
losslessly; only the runtime is rebuilt, from a backend that by then has the
edits.

`closeAll` does not fill the reopen queue. These tabs are not being closed by a
person, and offering to reopen them after teardown would be offering to reopen a
session that has ended.

## Persistence is paused

Nothing here is written to storage. `restore`, `persist` and `toPersisted` are
not implemented, and `PERSISTED_FIELDS` — the per-screen allowlist that decided
what outlives a reload — is not declared.

**Deliberate, and it is the reason rather than an oversight.** What a stored tab
should carry is a question about a shape that has just changed completely: a
target instead of a `ResourceRef`, an eleven-arm view state instead of an options
blob, a derived permanence instead of a stored one. Writing a format for that
before the screens exist means versioning a guess, and the storage policy here is
to discard on mismatch rather than migrate — so the guess would cost a user their
tabs the day it changed.

[`storage`](../storage/storage.md) is still constructed and holds its section
types unchanged. It is intact and unread, rather than torn out and rebuilt later.

The visible consequence: a reload opens on the singletons.

## Concurrency and SSR

- Every method is synchronous. Two cannot interleave, because none awaits.
- `runtimeFor` reaches an object that *is* asynchronous, and hands it over
  without waiting — the runtime's own status is what a view reads.
- This object touches no browser API at all. It is `$state` and arrays.

## Invariants

- **`activeId` names a real tab, always.** The singleton set is non-empty by
  construction, so there is nothing to fall back to.
- **One write path.** View state changes through `assignState` and nowhere else.
  `inspect()` is the single documented exception, because an inspection is never
  persisted and is not per-screen typed.
- **One identity function.** `targetKey()` is the whole definition of "already
  open", and `adoptTarget` is the only place a tab is minted.
- **`viewState.kind` always equals `screenKindOf(target)`**, established at mint
  and unreachable afterwards — `update` refuses a mismatched kind and cannot
  change one.
- **The model holds values; views hold bounds.**
- **The model holds labels; views hold vocabularies.**
- **No component type enters the model.** The `view-keys` rule enforces it, and
  it is also what makes this object extractable on its own.

## The contract a screen follows

- Restorable typed state goes in `viewState`, written with
  `update(tab.id, kind, patch)`.
- Editing a resource means `workbench.runtimeFor(tab.id)`. A view never touches
  [a register](../document-runtimes/document-runtimes.md) directly.
- Everything else reads a capability with `useQuery`. It is already a live
  subscription; do not wrap it.
- Internal selection is view state, not a tab. An investigation, an analysis, a
  slide, a sheet — all the same shape of thing.
- Never derive an inspection from focus. Clicking into the inspector blurs the
  editor, and a focus-derived inspection would empty the panel the user is
  reaching for.
- **Assume the centre remounts on every tab switch.** The rules above exist for
  it.

## File Tree

```text
workbench/
├── workbench.md
├── index.ts
├── types.ts
├── definition.svelte.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── open/
│   │   ├── open.md
│   │   ├── open.ts
│   │   └── resolve-launcher.ts
│   ├── activate.ts · close.ts · close-all.ts · reopen-closed.ts · reorder.ts
│   ├── frame.ts · resize.ts · inspect.ts · inspected-node.ts
│   ├── select-context.ts · update.ts · runtime-for.ts
│   └── shared/
│       ├── shared.md
│       ├── active-tab.ts · adopt-target.ts · assign-state.ts · target-key.ts
└── test/
    └── unit/
```
