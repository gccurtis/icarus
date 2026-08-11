# actions.ts

The **editor actions** — the table of ~25 commands the inspector calls, and the last unit
workstream C's §4 order named. It was deliberately extracted **last**, after `PmStateHost`
collapsed `state`/`dispatch`/`hooks` into one collaborator; before that the actions touched 24
distinct runtime members and moving them would have relocated code rather than drawn a boundary.

## Two write paths, and every action is one of them

This is the single most useful thing to know before reading any individual action:

- **Differ-backed** — block kind, text type, insert element, list type, marks, links, quote,
  columns. Dispatch a ProseMirror transaction; `diffDoc` discovers the change on the next flush.
  Nothing is queued by hand.
- **Overlay-backed** — alignment, indent, line spacing, the whole typography cascade. Patch the
  overlay, queue the matching `ChangeOp` as an "extra", then `host.commitOverlayEdit()`. These
  change nothing the differ can see, so they drive the sync cycle themselves.

Mixing the two in one action would double-apply the edit. When adding an action, decide which path
it is on first.

## The ActionsHost seam

```ts
export interface ActionsHost {
  readonly projectId: string;
  readonly resourceId: string;
  readonly title: string;
  setTitle(title: string): void;
  resolving: boolean;
  selection(): SelectionInfo;
  setInspection(override: InspectionOverride | null): void;
  markDirty(): void;
  commitOverlayEdit(): void;
}
```

Nine members — the same size as `SyncHost`, and the number that made this extraction worth doing.
The three collaborators the actions drive (`pm`, `sync`, `overlay`) are passed in whole via
`ActionDeps`; `ActionsHost` is only what is left over: runtime identity, the pinned inspection, and
two side effects. `DocumentRuntime implements ActionsHost`, so the compiler checks it.

One action is contract-kept rather than used: `inspectBlock` lost its only caller when workstream D
deleted `RowLens` (unreachable by design, UX1), but `EditorActions` is a frozen contract
(`editor/session.ts`), so the action stays and still works.

## A factory, not a class

```ts
export function createEditorActions({ host, pm, sync, overlay }: ActionDeps): EditorActions
```

`EditorActions` is a plain object contract in the frozen `editor/session.ts`, so the actions are
returned as an object literal with the dependencies captured in the closure. The shared reads
(`targetBlock`, `targetRanges`, `blockPosition`, `effectiveStyle`, `effectiveCustom`,
`queueStyleDefinition`) are closures above the `return` — private by construction, with no `this`
to get wrong.

## The shared reads

`targetBlock()` is what "the inspected block" means: the `block` or `new-block` lens's block, and
`null` otherwise. Actions that only make sense on one block (`setBlockKind`, `setListType`,
`setPrompt`, `resolvePrompt`) all start there.

`targetRanges()` returns a concrete range **only for the `run` lens**. Selected Text is the one
mode with a real inline range; Next Text applies marks through `storedMarks` at the caret instead,
and blocks and rows deliberately expose layout only. An action that gets `[]` here does nothing —
that is the intended no-op, not a missing case.

`effectiveStyle`/`effectiveCustom` resolve **overlay over snapshot**, so an action reads its own
not-yet-confirmed edits back. Without that, two quick alignment clicks would each start from server
truth and the second would discard the first.

## queueStyleDefinition — ordering inside the changeset

```ts
if (overlay.has((op) => op.op === 'put_style_definition' && op.style?.id === styleId)) return;
overlay.queue({ op: 'put_style_definition', style: typographyStyleDefinition(typography) });
```

Called *before* the op that references the style, because within a changeset a definition must
exist before the op pointing at it. `put` is idempotent, so re-queuing an existing definition is
safe; the `has` check is to keep the changeset small, not for correctness.

## Actions worth reading closely

**`setTextType`** converts every text-kind block the selection touches, walking positions
**high-to-low** so earlier offsets stay valid. That is safe only because text types keep the same
node size — `convertBlockAt` swaps paragraph↔heading in place. An element conversion could not use
this loop.

**`insertElement`** has four shapes because the node kinds differ: a divider is a leaf and needs a
trailing paragraph to type into; a list needs the caret placed inside its first item (two opening
tokens deep); an empty line is retyped in place; anything else inserts after. New nodes carry a
null `blockId`, which is what lets the differ emit `insert_block` with the right kind.

**`setRowHeight`** is row-scoped in the UI but per-block in Omega: it emits one
`set_block_line_height` per block in the row so the whole row moves together. The row height also
goes into the overlay, which is what the presentation pass paints from.

**`setLink`** validates the href at the **write** boundary as well as the render boundary. Omega
accepts any non-empty href (verified 2026-07-27 — catalog **S1**/**S4**), so an unsafe value typed
here would be stored and served to every other reader. A rejected link raises a toast rather than
silently doing nothing. See [`$systems/documents/sanitize`](../../../../systems/documents/sanitize.ts.md).

**`addColumn`** is the one action that splices the snapshot directly. Columns are just multiple
blocks sharing a row, so it queues `insert_block` **and** inserts a ProseMirror node carrying the
*same* block id — a fresh node would be force-assigned its own row by the differ's `rowFor`, which
is precisely what a column must not be.

**`setDefaultTypography`** deliberately skips `commitOverlayEdit`: the document-wide default renders
through the stage's CSS variable rather than block decorations, so it has no presentation refresh to
do. Collapsing it for uniformity would add a pointless full repaint to every base-font change.

**`resolvePrompt`** is the only long-running action — flush, enqueue an Omega job, poll once a
second for up to two minutes, then reload server truth. It publishes `host.resolving` so the
inspector can show progress, and clears it in a `finally` so a failure cannot leave the panel stuck.

## Focus

Almost every action ends with `pm.focus()`. An inspector control takes focus when clicked, so
without this the caret stays in the panel and the user's next keystroke is lost.
