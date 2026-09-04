# Keystroke to Change Set

Published at https://claude.ai/code/artifact/4d3c2844-b5f4-4ba9-b43b-15f35e2377b5

How a letter typed in the document editor becomes a row the server approves — and
finds its way back.

The editor holds no document. It holds a projection of one, and every gesture
against that projection is translated into operations addressed by id, coalesced,
and submitted for approval. Nothing is saved because it was typed; it is saved
because the server could apply it.

| | |
| --- | --- |
| Projection | 4 node types |
| Op shapes | 5 |
| Flush after | 2000 ms |
| Re-read every | 5000 ms |
| Retries | 1 |

## The shape of it — three parties, and none of them trusts the next

A document lives in four places at once, and the interesting design is in what
each one is allowed to believe.

ProseMirror holds a *drawing* — pages, rows, text blocks — that exists only to be
typed into. The runtime holds a *body* and a revision number, which is the last
thing the server confirmed plus whatever has not been sent yet. The server holds
the *leader*, which is the only version that is true. And the store holds a JSON
file per table under `app/data/`, which is what survives a restart.

The editor may not write to the store. The runtime may not decide it is right.
The server may not accept what it cannot apply. Every rule below falls out of
those three.

| Layer | Holds | Is allowed to |
| --- | --- | --- |
| `document.svelte` | an `EditorState` and `sent`, the body its last ops were measured from | emit ops, never send them |
| `document-runtimes/` | `body`, `revision`, a buffer, two history stacks | submit, retry once, give up loudly |
| `capabilities/document/` | nothing — it reads the store per call | apply ops, or refuse them |
| `app/data/*.json` | the leader snapshot and every change set behind it | be the truth |

## The projection — a schema that can only draw text

The ProseMirror schema is deliberately smaller than the document model. There is
no node for a divider, a page break, an image, a table or a mark — and no marks
at all. Anything a body holds that is not display text is carried straight
through and put back, which is what makes ignoring something the same as
preserving it.

```
doc            content: page+
└─ page        content: blocks_row+          — computed, never stored
   └─ blocks_row  attrs: rowId, proportions
      └─ text_block  attrs: blockId, atomId, share
         └─ text

marks: {}                                     — none, on purpose
```

Every identified node carries its resource-local `#id` in attrs. That is the
whole trick: it makes the diff identity-based rather than positional, and it
keeps ids stable when repagination moves a row from one page to the next.

### What each procedure is for

| File | Entry points | Does |
| --- | --- | --- |
| `schema.ts` | `schema` | The four node types above. |
| `ids.ts` | `mint(kind)` | `#r`, `#b`, `#a` plus six base-36 characters. Unique within the resource only. |
| `page-setup.ts` | `layoutMetrics`, `fitZoom`, `gutterOf` | Paper and margins into a character budget, a line budget, and what the page is drawn at. |
| `paginate.ts` | `paginate`, `pack`, `linesOfRow` | Greedy word wrap at each block's share of the measure; the tallest block sets the row's height. |
| `projection.ts` | `docOf`, `bodyOf`, `repaginate` | Body → doc, doc → body, and redistribution across pages without touching node identity. |
| `translate.ts` | `translate(was, now)` | Two bodies into ops, keyed on ids. |
| `editing.ts` | `splitRow`, `mergeRow` | Enter and Backspace, ahead of the base keymap. |
| `inspecting.ts` | `signalOf`, `worthSending` | The selection, as something the inspector can be addressed by. |

### Pagination is arithmetic, not measurement

No line boxes are read back from the DOM. `layoutMetrics` turns the paper size
and margins into a character-per-line and a lines-per-page figure using a fixed
average glyph width, and rows are packed against that estimate.

```ts
// procedures/page-setup.ts
const PAGE_WIDTH_REM = 52;
const BODY_LINE_HEIGHT_REM = 1.625;
const AVERAGE_GLYPH_WIDTH_EM = 0.52;

const charactersPerLine = Math.floor(
  (content.width * scale) / (BODY_FONT_SIZE_REM * AVERAGE_GLYPH_WIDTH_EM)
);
const linesPerPage = Math.floor((content.height * scale) / BODY_LINE_HEIGHT_REM);
```

A page is therefore a computed thing with no attrs of its own and no id — which
is why a page break in the body is a row, and a page in the drawing is not
addressable by anything.

### Carrying what it will not draw

`bodyOf` rebuilds only the rows it drew. Everything else — a divider, an explicit
break, an image block, a text block whose atoms are not one literal — is
remembered by the id of the last drawn thing before it, and spliced back into
place afterwards.

```ts
// procedures/projection.ts
// after = the id of the nearest drawn thing before it.
// null belongs at the head; a vanished anchor goes to the end.
type Held<T> = { readonly item: T; readonly after: string | null };

export const bodyOf = (doc, previous) => {
  const drawn = rowNodesOf(doc).map((row) => rowOf(row, rowsBefore, blocksBefore));
  return { ...previous, rows: putBack(drawn, heldAmong(previous.rows, drawableRow)) };
};
```

## The diff — two bodies in, five op shapes out

`translate` never looks at a ProseMirror transaction. It compares the body before
against the body after, matches by id, and emits ops in a fixed order: edits,
then removals, then insertions, then moves — so an insertion never has to be
renumbered around a removal that has not happened yet.

| Op | Path | Emitted when |
| --- | --- | --- |
| `text` | `#b7x2/atoms/#a91` | one literal atom's text changed — common prefix and suffix trimmed to a single splice |
| `set` | `#r4m1/proportions` | a row's column widths changed |
| `insert` | `rows` | a row id in the new body and not the old |
| `remove` | `rows` | a row id in the old body and not the new — carries `values` so it can be inverted |
| `move` | `rows` | a surviving row's anchor changed |

> **There are no indices anywhere.** Because ids are unique within the resource,
> an `#id` segment resolves on its own — `#b7x2/atoms/#a91` is complete whether
> that block sits in a document row, a table cell or a slide element. Inserting a
> row above `#b7x2` does not change the path to `#b7x2`, so the index
> transformation that positional paths would need does not exist rather than
> being rare.

## The runtime — a buffer, two stacks, and one number that means something

The runtime is the only object that knows what has been agreed. `revision` is not
a counter of edits — it is the revision the server last confirmed, and it is what
every change set is authored against.

```ts
// document-runtimes/definition.svelte.ts
export class Runtime implements DocumentRuntime {
  body      = $state<DocumentBody | undefined>(undefined);
  revision  = $state(0);
  sync      = $state<SyncState>("loading");

  buffer    = $state.raw<readonly DocumentOp[]>([]);   // not yet sent
  undoStack = $state.raw<readonly HistoryEntry[]>([]);
  redoStack = $state.raw<readonly HistoryEntry[]>([]);

  inFlight  = $state(false);
}
```

### When it decides to send

Every `apply` schedules. Whichever threshold arrives first wins, and both come
from `app/configuration/revisions.yaml` rather than from a constant in the model.

```ts
// document-runtimes/definition.svelte.ts · schedule()
if (this.buffer.length >= this.thresholds.afterOps) {   // a burst
  this.flushInBackground();
  return;
}
this.clearTimer();
this.timer = setTimeout(() => this.flushInBackground(), this.thresholds.afterMs);
```

### Coalescing, which is where the keystrokes go

Typing "hello" is five ops in the buffer and one on the wire. Two splices on the
same atom compose into one, because the second is stated against the string the
first produced and both are this author's in order — so composing them is
arithmetic over a single string. A pair that cancels out is removed entirely
rather than sent as a splice that changes nothing.

### Undo is not ProseMirror's undo

The editor runs `prosemirror-history` for its own caret-level undo, and the
runtime keeps a separate stack of op entries. Inverting an entry reverses the ops
and flips each one — `set` swaps value and `was`, `insert` becomes `remove`,
`move` swaps its anchors, `text` swaps insert and remove. The inverse is then
buffered like any other edit, so undo travels to the server as an ordinary change
set.

### The seven states it can be in

| State | Meaning |
| --- | --- |
| `loading` | Attached, nothing read back yet. |
| `saved` | Buffer empty, leader confirmed. |
| `saving` | A change set is in flight. |
| `rebasing` | Refused as stale; ops re-stated, retrying once. |
| `needs-review` | Refused twice, or unapplicable. Buffer dropped, body re-read. |
| `offline` | Reserved; nothing sets it yet. |
| `error` | The call threw. Ops are put back at the head of the buffer. |

### Reading again, without ever overwriting work

A runtime with nothing outstanding is a reader, and a reader that never reads
again shows the document as it was when the tab was opened. So a sync runs on
attach, after every accepted flush, after a revert, and on an interval — and
refuses to run at all unless the runtime is settled. The check is made twice,
because a keystroke during the round trip makes the answer stale before it lands.

```ts
// document-runtimes/methods/sync.ts
const settled = (runtime) => runtime.buffer.length === 0 && !runtime.inFlight;

export const sync = async (runtime) => {
  if (!settled(runtime)) return;

  const question = readDocumentBody({ resourceId: runtime.id });
  await question.refresh();          // or the client cache answers forever
  const found = question.ready ? question.current : await question;

  if (!settled(runtime)) return;      // a keystroke landed mid-flight

  runtime.body = found === null ? emptyBody() : found.body;
  runtime.revision = found === null ? 0 : found.revision;
};
```

### Closing a tab does not close the document

A released runtime moves from `open` to `settling` — its timer cleared, its
interval cancelled — and is flushed one last time. It is only forgotten if that
flush left it clean; a runtime in `error` or `needs-review` stays in `settling`,
and re-opening the tab picks up the same object with its buffer intact.

## Integration — how a view is allowed to reach any of this

A view may not import a runtime register. It asks workspace state which runtime a
resource already has, and is handed the one that is open rather than one of its
own — the rule `view-imports-no-surface` holds the line, and
`runtime-through-workspace-state` states the intent.

```ts
// workspace-state/methods/document-runtime.ts
export const documentRuntime = (state, resourceId) => {
  if (state.documents === undefined) {
    throw new Error("This workspace state holds no document runtime register…");
  }
  return state.documents.attach(resourceId);
};
```

The register is *borrowed*. Workspace state does not build it and does not
release it — `runtime/client/start.ts` constructs both registers and passes them
in, and workspace state only knows how to ask.

### Two things the tab owns on the document's behalf

**Zoom** lives on the tab view beside the frame, not in it: the frame is the
shell's geometry, which the panels own between them, and zoom is the centre's
alone. It is `null` until someone zooms, and a `null` zoom means the page fills
whatever width it is given and goes on filling it as that width changes. It
travels as a workspace op, so it is undoable and it persists.

**The inspector** is addressed the same way. The editor turns its ProseMirror
selection into a key and an address and calls `view.inspect`; because that is an
op like any other, the panel's subject is part of the workspace a reload
restores.

| In the editor | Key | `id` | `at` |
| --- | --- | --- | --- |
| a range inside one block | `text-selection` | `#b1/atoms/#a1@6` | `#b1/atoms/#a1@18` |
| a range across two blocks | `text-selection` | `#b1/atoms/#a1@6` | `#b2/atoms/#a2@4` |
| caret in a block with text | `next-letter` | `#b1/atoms/#a1@6` | — |
| caret in an empty block | `empty-block` | `#b1/atoms/#a1@0` | — |

Nothing is sent when the inspector already says it, and `next-letter`
additionally never re-fires while the inspector is already on `next-letter` — so
moving the caret inside a block is silent, and you leave that state only when a
selection or an empty block fires.

## Execution flow — one letter, end to end

This is a real sequence, so it is numbered. Everything below happens between
pressing a key and the status reading `Saved`.

1. **ProseMirror dispatches a transaction.** Not committed yet —
   `dispatchTransaction` is overridden, so the view holds still until the editor
   says otherwise. *(content/document.svelte · dispatch())*
2. **`lay()` stamps ids and repaginates.** New nodes get minted ids; rows are
   re-packed against the current metrics. If the doc is unchanged the state
   passes through untouched. If it changed, the layout transaction is marked
   `addToHistory: false` and tagged, and the caret is restored by anchor rather
   than by position. *(projection.ts · stampIds → repaginate → anchorAt /
   positionOf)*
3. **The inspector signal fires.** Before the doc-changed guard, so a selection
   that moved without editing still reaches the panel. *(inspecting.ts · signalOf
   → worthSending → view.inspect)*
4. **Layout transactions stop here.** A repagination must not echo back as an
   edit, so the tagged transaction returns before `emit`. This is the one place a
   bug would produce an infinite loop. *(dispatch() ·
   transaction.getMeta(LAYOUT))*
5. **`emit()` measures against `sent`, not against the runtime.** `sent` is the
   body the last ops were measured from. Diffing against it rather than against
   `runtime.body` is what keeps ops from being emitted twice while a flush is in
   flight. *(bodyOf(state.doc, sent) → translate(sent, body))*
6. **`runtime.apply` pushes onto the undo stack and the buffer.** The redo stack
   is cleared, and `schedule()` arms the timer — or flushes immediately if the op
   count threshold has been reached. *(document-runtimes/methods/apply.ts)*
7. **`flush()` coalesces and submits.** The buffer is folded, emptied, and sent
   as a change set stating `baseRevision` — the revision these ops were authored
   against. `pendingFlush` makes concurrent flushes one flush.
   *(methods/flush/flush.ts · coalesce → submitDocumentChanges)*
8. **The server applies them, or does not.** Scope first, then validation, then
   the leader. Applying is the approval: `apply-ops` throws on anything it cannot
   resolve, and that throw is the refusal.
   *(capabilities/document/api/submit-document-changes/)*
9. **Two rows are written, atomically as far as the caller sees.** A
   `documentChangeSets` row at the new revision, then the `documentSnapshots`
   leader replaced, then `updatedAt` and `updatedBy` on the `documents` row.
   *(store.create → store.update)*
10. **The runtime takes the new revision and re-reads.** `sync` is fired without
    awaiting it, so the status settles on `Saved` immediately and the body
    catches up with anyone else's accepted work a beat later. *(flush.ts ·
    landed(runtime) → void sync(runtime))*
11. **The paint guard decides whether to redraw.** A new body object arrives, but
    if `translate(sent, body)` is empty it says nothing the editor does not
    already show — so `sent` is advanced and the caret is left alone. Only a body
    that actually differs causes a repaint. *(content/document.svelte · $effect on
    runtime.body)*

## The wire — what actually travels

No body is ever sent to the server. Only ops travel, and acceptance *is*
successful application — which is what makes the revision number a claim about a
state rather than a count of submissions.

| Editor (client) | Change set (POST) | Store (server) |
| --- | --- | --- |
| 01 `bodyOf(doc, sent)` — the drawing, read back as a body | 04 `coalesce(buffer)` — five keystrokes fold to one splice | 07 `requireScope()` — which project is never a parameter |
| 02 `translate(sent, body)` — two bodies, matched by id | 05 `submitDocumentChanges` — a command, not a query | 08 `leaderOf(store, …)` — revision 6? then apply |
| 03 `runtime.apply(ops)` — buffered, undo stack pushed | 06 `baseRevision: 6` — the revision these ops assume | 09 `applyOps(body, ops)` — throws, and the throw is the refusal |

```js
// 01–03 · what the editor emits
{ op: "text",
  target: "atom",
  path: "#bbody1/atoms/#abody1",
  at: 147,
  insert: "d",
  remove: "" }

// 04–06 · what goes over the wire
{ changeSet: {
    resourceId: "documents:1",
    baseRevision: 6,
    ops: [ … ],
    touched: ["#bbody1/atoms/#abody1"]
} }

// 07–09 · what the store writes
documentChangeSets +1 row
  revision: 7  tier: "recent"

documentSnapshots leader ⟵
  revision: 7  role: "leader"
```

**◀── `{ accepted: true, revision: 7 }`** — the runtime takes the number, sets
`saved`, and fires `sync`, which re-reads the leader and hands the body back to
the editor. The paint guard drops it if it says nothing new.

## Refusals — three answers, and only one of them is yes

| Answer | What happens |
| --- | --- |
| `accepted` | The leader was at `baseRevision` and every op applied. A change set row is written, the leader is replaced, and the client takes the new revision. **Nothing is retried.** |
| `stale` | The leader has moved on. The client adopts the new revision, puts the refused ops back at the head of its buffer, and submits once more. **Exactly one retry** — a second refusal is not a third attempt. |
| `unresolved` | An op named something the body does not hold — an atom whose text has moved under a splice, a row id that is gone. Not retryable at any revision. The buffer is **dropped**, the body is re-read, and the state becomes `needs-review`. |

Dropping the buffer is deliberate. An editor that kept ops the server has refused
would be showing a document nobody else can see, and every subsequent change set
would be authored against a body that does not exist.

> **A thrown call is different from a refusal.** If `submitDocumentChanges`
> rejects — the network, not the server's judgement — the ops go back to the head
> of the buffer, the state becomes `error`, and the error is re-thrown. Nothing
> is lost, because nothing was decided.

## Standing gaps — what is designed and not built

- **Marks, images, tables and formulas are carried, not edited.** The schema has
  no node for any of them; the projection preserves them byte for byte through an
  editing session and `translate` emits nothing for them.
- **Header, footer and page numbering exist in the model and nowhere else.**
  `PageFurniture` and `PageNumbering` are in the body type; the editor neither
  draws nor damages them.
- **Page setup is not read from the body yet.** `DEFAULT_PAGE_SETUP` stands in
  until document bodies persist their own.
- **No lens is built for any document inspector key.** All four signals land on
  `PanelPlaceholder`, which names the key and the address — routing is provable
  before the panel exists.
- **Runtimes are not refcounted.** Two tabs on one document share a runtime, and
  the first release moves it to `settling` for both.
- **Conflict detection is revision equality, not path overlap.** The workspace
  capability compares touched paths; the document capability does not, so any
  concurrent write is stale even when the two edits could not collide.

---

`app/src/lib/app-views/categories/document-editor` ·
`app/src/lib/model/client/document-runtimes` ·
`app/src/lib/capabilities/document`
