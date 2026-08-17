# The workbench model

The coordinating client object, as it should be rather than as it is at `c7578e2`.
Settled across a design review; this is what an implementer builds from and what
`main` takes.

Its companion is [resource runtimes](resource-runtimes.md), which owns
everything this one deliberately does not.

## One state object, five surfaces that are functions of it

The workbench holds every tab and everything a tab is. The tab strip, context
panel, work surface, inspector and status bar read it directly and write back
through its methods. There is no event bus, no store subscription, no props
drilling, and no surface-to-surface communication — the model is `$state` and
Svelte's reactivity is the whole delivery mechanism.

Three things that were once separate objects fold in here: the context rail, the
inspector, and panel geometry. All three read and wrote the active tab, and being
handed a workbench at construction was the tell.

**One thing folds back out.** A live resource runtime was a field on `Tab`, and it
moves to an object of its own — the same test applied in the other direction, and
[the reason is there](resource-runtimes.md).

## Three kinds of tab

Identity is the only axis a target expresses.

```ts
type TabTarget =
  | { kind: "singleton"; screen: SingletonScreen }
  | { kind: "resource"; resourceType: GeneralResourceType; resourceId: string }
  | { kind: "launcher" };
```

**Singletons** are one per project and always open: project overview, research,
analysis, templates, personas, automations, context. **Resources** are the three
bodies `revisions` edits. **Launchers** have no identity at all.

Research and analysis are singletons rather than id-bearing tabs, and that is the
correction worth stating plainly: each has its own internal selection — an
investigation, an analysis — exactly as a deck selects a slide. That belongs in
view state. A tab per investigation would make the strip the navigation for a
screen that already has its own.

### `permanent` stops being a stored field

Every singleton is permanent, so permanence is no longer an independent fact about
a tab — it is `target.kind === "singleton"`. The boolean comes off `Tab` and
becomes a derivation, which removes the one place the two could disagree. You do
not close a singleton any more than you close project overview; not being on one
*is* closing it.

### The launcher never dedupes

`targetKey()` answers "is this already open", and a launcher has no identity, so it
returns `undefined` and `adoptTarget` mints a fresh tab whenever the key is
absent. Open five, get five. It is otherwise an ordinary workspace tab, with a
context panel and inspector of its own.

## State

| Field | Type | Persisted |
| --- | --- | --- |
| `tabs` | `readonly Tab[]` | yes |
| `activeId` | `TabId` | yes |
| `closed` | `readonly Tab[]` | no |

`tabs` holds singletons first, then closable tabs in user order. `activeId` is
never empty, because a singleton cannot be closed and one therefore always remains
— an invariant rather than a hope. `closed` is the reopen queue, capped at ten,
holding whole tabs so that a reopen restores view state rather than just identity.

```ts
type Tab = {
  readonly id: TabId;
  readonly target: TabTarget;
  viewState: WorkbenchViewState;
  inspected?: InspectionKey;
};
```

The tab holds **no handle on its runtime, not even an id**. The key is the
resource identity the target already carries, so an implementer calls
`resourceRuntimes.attach(resourceType, resourceId)` with what they already have.
An allocated id would be a third name for a thing that already has two, and a
third name is a third thing to keep in step.

## `viewState`

The screen's whole typed working state, one arm per screen kind. Not the selected
context — that is one field, two levels down.

```ts
tab.viewState = {
  kind: "document",
  frame: {
    contextId,                                    // the rail position
    contextCollapsed, contextWidth,
    inspectorCollapsed, inspectorWidth
  },
  zoom, scrollAnchor?, selection?, findQuery
};
```

It is called `viewState` and not `state` because four different things in this
object are state, and the ambiguity cost more than the four extra characters.

`frame` is the shell's own per-tab geometry and every member is present from the
moment a tab is minted — no optionality, so no read path that reports a default it
never stored.

### What survives a reload

`PERSISTED_FIELDS` names, per screen, which fields outlive a reload. Document keeps
`zoom` and `findQuery` and drops `scrollAnchor` and `selection`, because a position
into a document that may have changed since is a position that means nothing on
restore.

Three things read that one declaration, which is why it is a table and not three
lists: `assignState` asks whether a patch is worth a write, `toPersisted` projects
a tab through it, and `storedState` admits a stored field only if it appears in it.

**Type it.** Today it is `Record<ScreenKind, readonly string[]>` — thirty-five
unchecked strings, where a typo is silent in both directions: never written *and*
never restored. Declared as

```ts
readonly (keyof Omit<ViewStateFor<K>, "kind" | "frame">)[]
```

a misspelling stops compiling. The shared-table property survives, which per-arm
pick functions would lose — `assignState` asks a membership question, not a
projection question.

## `inspected` is a key

What the user is looking at, as a namespaced label and nothing more.

```ts
type InspectionKey =
  | "empty"
  | "block.text-selection" | "block.image" | "block.table" | …
  | "document.settings" | "document.page" | …
  | "copilot.persona-thread" | "copilot.tool-call" | …
```

It carried a payload before — `block.text-selection` held `{ blockId, from, to }` —
and that was **a second record of what the user has selected**, beside the one
already in `viewState.selection`. The inspector still routes on the prefix before
the dot; it reads the detail from view state, and for the copilot family from the
copilot object, since those belong to no tab.

The ancestry array goes with it. It existed so the inspector could render a
breadcrumb, and a screen can derive that from its own view state — which is where
the structure it would be walking already lives.

**Not persisted.** A key is trivially serialisable, but it is only meaningful if
what it points at survives too, and the detail is exactly the class of thing that
is deliberately dropped. `document.settings` would restore perfectly and
`block.text-selection` would not, so persisting it means a second allowlist beside
`PERSISTED_FIELDS`. An inspector that opens empty after a reload is the honest
report of what the client actually knows.

## Methods

**Tab lifecycle** — `open` returns the existing tab when the canonical target is
already open. `resolveLauncher` turns a launcher into the thing it created, keeping
the same `TabId` and slot, or transfers into an existing tab and closes the
launcher. `close` throws for a singleton. `closeAll` clears to the singletons and
deliberately does not persist. `activate`, `reorder`, `reopenClosed`.

**View state** — `update<K>(id, kind, patch)`. The kind is an argument because a
patch against an eleven-arm union cannot be narrowed from the patch itself, and the
alternative is a cast — which is exactly how a document's `zoom` ends up on a
persona library. Restating it makes the narrowing sound at compile time and a wrong
caller a thrown error rather than a corrupted tab.

**Context rail** — `availableContexts`, `activeContext`, `selectContext`.

**Inspection** — `inspectedNode`, `inspect`.

**Frame** — `frame`, `resize`.

**Runtime** — `runtimeFor(id)` returns the resource runtime for a tab, or
`undefined` for a tab that is not a resource. It is the **only** way a view reaches
one: the workbench borrows the register, calls `attach` as part of opening a
resource tab and `release` as part of closing one, and hands the result out here. A
view calling `attach` itself would tie runtime lifetime to a component's mount,
which is the case this whole design exists to prevent.

Sixteen in total. Gone from the built version: `attachRuntime`, `runtime`,
`retiring` and the whole retire and `released` machinery, all now the register's;
and `selectTabs` with `selectedIds`, deferred until the strip has a drag gesture,
since nothing fills the selection today and that makes the grouped branch of
`reorder` unreachable rather than merely uncalled.

`assignState` is not a public method and should not become one. It is the procedure
in `methods/shared/` that `update`, `resize` and `selectContext` route through.

### Two asymmetries that are deliberate

`selectContext` throws for a context the rail never offered; `activeContext` falls
back silently for one it no longer offers. A tab's remembered context can *drift*
out of range — a templates tab switching mode swaps to a disjoint rail — and a
reset rail is harmless where a crash is not. A caller naming a context that never
existed is a defect.

`resize` records values only and cannot reach `contextId`. So a drag can never move
the rail and a rail click can never resize a panel, structurally rather than by
convention.

## Construction

A singleton per client instance, built with the standard's three verbs and their
three different callers.

```ts
// model/client/workbench/constructor.ts
export const createWorkbench = (
  storage: ClientStorage,
  runtimes: ResourceRuntimesModel
): WorkbenchModel => …

// model/client/constructor.ts — pure composition, holds nothing
export const buildClientModel = (input: ClientModelInput): ClientModel => {
  const storage = createStorage(input);
  const resourceRuntimes = createResourceRuntimes();
  const workbench = createWorkbench(storage, resourceRuntimes);
  const copilot = createCopilot(workbench);
  const commands = createCommands(workbench, copilot);
  return { storage, resourceRuntimes, workbench, copilot, commands };
};

// model/client/index.ts — the one place that assigns the instance
initClientModel(input);   // called by /app/[project]/+layout.ts
clientModel();            // the accessor every view uses
```

The workbench borrows two objects and owns neither. It builds the permanent
singleton tabs in its constructor rather than restoring them, which is what makes
"`activeId` is never empty" an invariant rather than a hope, and then calls
`restore` to lay the stored tabs over the top.

`ClientModel.close()` releases in reverse order of construction: `closeAll()` first,
so the workbench hands its tabs' runtimes back, then `releaseAll()` disposes
anything left.

## Terminal behaviour

`close(id)` splices from `tabs`, pushes the whole tab onto `closed` — capped at
ten, the oldest falling off and simply dropped — and for a resource target calls
`resourceRuntimes.release(type, id)`.

**Release at close, not at dequeue.** Release is the flush: a closed tab holding an
unflushed buffer means the user's last edits sit unsent until ten unrelated tabs
close. The queue still holds the whole tab, so a reopen restores zoom, find query,
rail position and panel widths losslessly; only the runtime is rebuilt, from a
backend that by then has the edits.

`closeAll()` is reached from `ClientModel.close()`, which the `/app` layout calls
from `$effect` cleanup. It calls `resourceRuntimes.releaseAll()` and does not
persist — writing an emptied strip on teardown would erase what a reload is meant
to restore.

## Invariants

- **`activeId` names a real tab, always.** The singleton set is non-empty by
  construction, so there is nothing to fall back to.
- **One write path.** View state changes through `assignState` and nowhere else,
  which also decides persistence. `inspect()` is the single documented exception,
  because an inspection is never persisted and is not per-screen typed.
- **One identity function.** `targetKey()` is the whole definition of "already
  open", and `adoptTarget` is the only place a tab is minted.
- **The model holds values; views hold bounds.** A context width is model state;
  the minimum, the maximum and the collapse threshold belong to the panel that
  enforces the drag.
- **No component type enters the model.** The model publishes stable keys and
  `views/` resolves a key to a component. The `view-keys` rule enforces it, and it
  is also what makes this object extractable on its own.

## The contract a screen follows

- Restorable typed state goes in `viewState`, written with
  `update(tab.id, kind, patch)`. List it in `PERSISTED_FIELDS` only if it should
  survive a reload.
- Editing a general resource means `workbench.runtimeFor(tab.id)`. A view never
  touches [the register](resource-runtimes.md) directly.
- Everything else reads a capability directly with `useQuery`. It is already a live
  subscription; do not wrap it.
- Internal selection is view state, not a tab. An investigation, an analysis, a
  slide, a sheet — all the same shape of thing.
- Never derive an inspection from focus. Clicking into the inspector blurs the
  editor, and a focus-derived inspection would empty the panel the user is reaching
  for.
- Assume the centre remounts on every tab switch. The rules above exist for it.

## Landing this on `main`

The model layer imports nothing outside itself but `$app/environment`, and
`lint:model` passes on a model-only merge. The blocker is not lint — it is
`svelte-check`, because `CONTEXT_IDS` goes from two members to fifty and
`COMMAND_IDS` from four to nine, and both are consumed on `main` through exhaustive
`Record<K, …>` maps. Widening a const array silently breaks every consumer holding
a total map.

So the seam is the model **plus** the rewired shell views, the screens registry and
eleven placeholder screen roots. Screen bodies, specifications and the
forward-declared capability aliases all stay behind.

## Related

[resource runtimes](resource-runtimes.md) ·
[copilot](copilot.md) ·
[model directory](../../app/docs/model-directory/model-directory.md)
