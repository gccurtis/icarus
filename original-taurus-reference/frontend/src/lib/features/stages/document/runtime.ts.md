# runtime.ts

The **document runtime** — the client-side object model behind a document tab. A `DocumentRuntime`
holds one open document (the live ProseMirror state, the last-synced Omega snapshot, and the sync
loop), survives tab switches, and keeps syncing whether or not a stage is mounted. The stage is
just a view that attaches and detaches.

The tabs ↔ open-resource-registry ↔ per-document-runtime arrangement this implements is described
in [`docs/archive/plans/2026-07-21-client-runtime-model.md`](../../../../../docs/archive/plans/2026-07-21-client-runtime-model.md),
which the file's own header comment cites; the shape it has *today* comes from the 2026-07-27
reorg ([`docs/archive/plans/2026-07-27-document-subsystem-reorg.md`](../../../../../docs/archive/plans/2026-07-27-document-subsystem-reorg.md)).

> **Rewritten 2026-07-27.** This companion used to mirror the file line by line. Workstreams B and
> C moved most of its content into `model/*`, and the repo's companion practice changed to prose
> (orientation §5). The mirror had already drifted — its import block still listed `appendChanges`,
> `createDocument`, and `diffDoc`, which moved to `model/sync.ts`. It now explains what is left and
> points at the model companions for the rest.

## Where the code actually lives

`runtime.ts` is no longer the runtime — it is the orchestrator composing eight collaborators, and
at **577 lines** (from 1623) it is finally small enough to read in one sitting. If you are looking
for behaviour, start with the companion for the unit that owns it:

| Concern | Lives in |
| --- | --- |
| The `EditorState`, `dispatch`, the attached view | [`model/pm-state.ts`](model/pm-state.ts.md) |
| Server truth + load / flush / reload / retry | [`model/sync.ts`](model/sync.ts.md) |
| Optimistic pending edits + the direct-op queue | [`model/overlay.ts`](model/overlay.ts.md) |
| PM selection → one of seven inspector lenses | [`model/selection.ts`](model/selection.ts.md) |
| Row heights, decorations, the session projection | [`model/presentation.ts`](model/presentation.ts.md) |
| The ~25 commands the inspector calls | [`model/actions.ts`](model/actions.ts.md) |
| Find-panel search | [`model/search.ts`](model/search.ts.md) |
| The rail sections this surface contributes | [`model/panels.ts`](model/panels.ts.md) |

What remains here is the wiring between them and the `EditorSession` projection.

## The four seams

`DocumentRuntime implements SyncHost, IndentHost, PmHost, ActionsHost`. Each is a small interface a
collaborator calls back through, so the compiler checks a boundary that a comment could only assert:

- **`PmHost`** (4 members) — the reactions a transaction triggers: `clearInspection`,
  `refreshPresentation`, `updateSession`, `scheduleSave`.
- **`SyncHost`** (9 members) — the editor half the sync engine cannot reach: the live doc to diff,
  the state rebuild, the caret, status, the view refresh.
- **`ActionsHost`** (9 members) — what the inspector's actions need that is neither ProseMirror,
  server truth, nor the overlay: runtime identity, the pinned inspection, and two side effects.
- **`IndentHost`** (2 members) — what the Backspace keymap needs to outdent a block.

Four interfaces on one class is not a smell here: each is the *other* side of a collaborator this
file constructs, and their sizes (4/9/9/2) are the measurement that says the decomposition landed.

## The editor plugin stack

```ts
keymap({ Backspace: outdentOnBackspace(host) }),
keymap(baseKeymap)
```

`plugins(host)` assembles history, the presentation decorations, selection highlighting, and
keymaps tried in order: formatting shortcuts, list editing (Enter splits an item, Tab nests), the
Backspace-outdent command, then the base keymap. `outdentOnBackspace` returns `false` when the
caret is not at the start of an indented block, so the base join-backward still runs — ordinary
Backspace behaviour is untouched everywhere else.

## Constructor order matters

```ts
this.sync = new SyncEngine(this, this.overlay, projectId, resourceId);
this.pm = new PmStateHost(this, schema.node('doc', null, [schema.node('paragraph')]), plugins(this));
this.actions = createEditorActions({ host: this, pm: this.pm, sync: this.sync, overlay: this.overlay });
void this.load();
```

The sync engine is built first because `plugins(this)` closes over the runtime as an `IndentHost`,
and `indentOf` resolves through `this.overlay` and `this.sync`. The keymap is not *called* until a
keystroke, but constructing it after both collaborators exist keeps that from being a fact you have
to know.

`actions` is assigned **in the constructor body**, not as a field initializer — it captures `pm` and
`sync`, which do not exist until the two lines above have run. The editor starts as one empty
paragraph; `load()` replaces it.

## refreshPresentation — the ONE pass

```ts
const signature = JSON.stringify([...rowHeightsPx.entries()]);
if (!force && signature === this.presentationSignature) return;
this.rowHeightsPx = rowHeightsPx;
```

Workstream B collapsed two full-document walks into this one (catalog **P-1**). It runs on every
document-changing transaction, so it short-circuits when the computed row heights are unchanged —
the common case, since typing does not change row geometry.

The retained `rowHeightsPx` map is why the inspector can never disagree with the page:
`updateSession` publishes the **same map** the decorations were built from, rather than recomputing
and hoping the two agree.

Its transaction is applied through `pm.applySilently` — this runs mid-`dispatch`, and re-entering
`dispatch` would recurse.

## commitOverlayEdit — the cycle overlay edits drive by hand

```ts
private commitOverlayEdit() {
  this.refreshPresentation(true);
  this.pm.pushState();
  if (this.sync.supportsCanonicalLayout) this.scheduleSave();
  this.pm.refreshSession();
}
```

Alignment, indent, line spacing, and the style cascade change nothing the differ can see — they
live in the overlay, not in the ProseMirror document — so they have to drive the whole cycle
themselves. Seven actions repeated this exact sequence; the plan's §3 called it out as "one
repeated optimistic-cache idiom at ~9 sites". Naming it means an action states *what* it did while
this states what that always implies.

The flush is conditional on `supportsCanonicalLayout`: without it Omega rejects the ops, so the
edit stays a local preview and the document is never marked dirty. The inspector says as much — see
`panels/shared/CanonicalLayoutNotice.svelte`.

## updateSession — the projection the panels render from

Runs per transaction, so it stays cheap. It assembles the `EditorSession`: the document projection
(outline, row keys, block/word/char counts) from `projectDocument`, the row heights from the
presentation pass, and four per-block maps the Details panel reads — alignment, semantic
typography, custom typography, and prompt data.

Every per-block value resolves **overlay over snapshot**, never the snapshot alone, so an
optimistic edit shows in the inspector the moment it is made rather than after Omega confirms it.

It bails to `editorSession.set(null)` when there is no document id or the load errored — the panels
render their empty state rather than a half-built session.

## The style cascade resolvers

`effectiveStyle`, `effectiveStyleRef`, and `effectiveCustom` are one-line bindings of the pure
resolvers in `model/presentation.ts` to *this* runtime's overlay and snapshot. They exist so callers
do not each have to remember that the overlay wins over server truth.

`queueStyleDefinition` queues a `put_style_definition` unless one is already pending. It is called
*before* the op that references the style, because within a changeset a definition must exist
before the op pointing at it — `put` is idempotent, so re-queuing an existing definition is safe.

## The actions table

`readonly actions: EditorActions` is built by `createEditorActions` and lives in
[`model/actions.ts`](model/actions.ts.md). What stays here is the `ActionsHost` implementation the
actions call back through — `selection()`, `setInspection()`, `markDirty()`, `commitOverlayEdit()`,
plus the identity fields and `resolving`.

`resolving` is a plain public field rather than a private one with accessors: `updateSession`
publishes it and the actions set it, which is exactly what `ActionsHost` declares.

## The documents manager

```ts
registerResourceKind('document', (projectId, resourceId, title, key) =>
  new DocumentRuntime(projectId, title, resourceId, key)
);
```

Registering the factory with the resource registry is what lets siblings (Quarterback, panels) ask
for the active document runtime without importing the document stage. `acquireDocument` is a
convenience wrapper over `acquire`; the registry owns disposal, keyed on `projectId:resourceId`.

`keyFor` still has a name-keyed fallback for tabs persisted before resources carried ids. Once no
such tabs remain, that branch goes.
