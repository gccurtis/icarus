# View State Ledger

*Icarus · representation + model/client · the state to build toward*

What is open, which tab is active, and what each one is showing — stored the way a
document is stored. One materialized row per person per project, and an
append-only history of change sets behind it. This is the finished shape.

## At rest — two tables

Both are keyed by **the person and the project**. View state is already
per-project — a user with two projects open has two independent sets of tabs — so
`userId` and `projectId` together identify a row, and every row in either table
carries both.

### `viewSnapshots` — one row per key

The materialized state. Replaced in place on every accepted change set.

```ts
type ViewSnapshotFields = {
  projectId: Id<"projects">;
  userId:    Id<"users">;
  revision:  number;
  tabs:      TabRecord[];
  activeId:  TabId;
  views:     Record<TabId, TabView>;
  at:        number;
};
```

### `viewRevisions` — append only

The history. One row per accepted change set, never rewritten.

```ts
type ViewRevisionFields = {
  projectId:    Id<"projects">;
  userId:       Id<"users">;
  revision:     number;
  baseRevision: number;
  ops:          ViewOp[];
  at:           number;
};
```

No `actor` — the row belongs to one person by construction. No `touched` and no
rebase: one writer per key means there is no collision to detect. No `part` and no
snapshot role: a view state is small and whole, so it is never split across rows.

### What sits inside a row

```ts
type TabRecord = { readonly id: TabId; readonly screen: Screen; readonly resourceId?: string };

type TabView = {
  subscreen:  Subscreen;
  focus:      string | null;
  contextId:  ContextId | null;
  inspected:  Inspected;
  selection:  Selection | null;
  frame:      Frame;
};
```

`null` rather than `undefined` everywhere in a stored shape: these round-trip
through JSON, and an absent key and a null are two spellings of one state.

## In flight — seven operations, each its own inverse

A revision is a numbered step; a change set is the ops that produced it. If you
open a tab and close it, the net effect is nothing — so the set, not the op, is the
unit that gets a revision number.

```ts
export type ViewOp =
  | { op: "open";     tab: TabId; at: number; target: Target; view: TabView }
  | { op: "close";    tab: TabId; at: number; target: Target; view: TabView }
  | { op: "activate"; was: TabId; now: TabId }
  | { op: "land";     tab: TabId; was: Landing; now: Landing }
  | { op: "context";  tab: TabId; was: ContextId | null; now: ContextId | null }
  | { op: "inspect";  tab: TabId; was: Inspected; now: Inspected;
                      wasSelection: Selection | null; selection: Selection | null }
  | { op: "resize";   tab: TabId; was: Frame; now: Frame };
```

| Operation | What it does | Inverted by |
| --- | --- | --- |
| `open` | mints a tab and its view | `close`, same payload |
| `close` | removes both halves | `open`, same payload |
| `activate` | moves the active tab | swap `was` ⇄ `now` |
| `land` | switches the centre, defaults the rail, clears the lens | swap the whole `Landing` |
| `context` | moves the rail | swap `was` ⇄ `now` |
| `inspect` | points the inspector at something | swap both pairs |
| `resize` | drags a flank | swap `was` ⇄ `now` |

`open` and `close` carry identical payloads on purpose, which makes them exact
mirrors — the same reason a resource `insert` carries `ids` it does not need in
order to apply. Everything else carries `was` beside `now`. So inversion reads no
state:

```ts
export const invert = (op: ViewOp): ViewOp => {
  switch (op.op) {
    case "open":    return { ...op, op: "close" };
    case "close":   return { ...op, op: "open" };
    case "inspect": return { ...op, was: op.now, now: op.was,
                             wasSelection: op.selection, selection: op.wasSelection };
    default:        return { ...op, was: op.now, now: op.was };
  }
};
```

`land` carries a whole `Landing` on both sides because landing on a subscreen
writes five fields together — it defaults the rail when the new subscreen does not
offer the old one, and clears the inspector unconditionally. Undoing it has to
restore all five.

## In memory — three objects where there is one

The seam is already written out six times in the current object — every method that
touches what a tab is showing opens with `const tab = state.active`, and no list
method touches anything but `activeId`.

```text
tab-list  ──────►  view-state  ◄──────  tab-views
what exists        coordinator          what each tab
the order          the log, undo        is looking at
which is active    the only writer
```

A `Tab` is a composition rather than a record, which is what lets the two halves be
owned separately:

```ts
get active(): Tab {
  const record = this.#tabs.active;
  return { ...record, ...this.#views.of(record.id) };
}
```

**The public surface does not change.** `ViewStateModel` keeps every member it has
today, the split sits entirely behind it, and `provideViewState` still hands one
object down the tree. No file under `views/` is edited.

| Object | Owns | Borrows |
| --- | --- | --- |
| `tab-list` | the list, the order, which is active | nothing |
| `tab-views` | one `TabView` per tab id | nothing |
| `view-state` | the log, undo, the composition | both, plus configuration |
| `commands` | chords and enablement | `view-state` |

Build order: configuration → tab-list → tab-views → view-state → commands.

Later, `tab-views` can split again into workspace, context and inspection — each
already owns a distinct key vocabulary. That split does not change `view-state`,
because the coordination it performs is identical either way.

## New behaviour — the log, and what it replaces

```ts
interface ViewStateModel {
  // … every existing member, unchanged …

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}
```

Every mutator records the op it performed before returning. `undo` pops the log,
applies `invert(op)`, and pushes to `undone`; `redo` walks it back the other way.

**The closed queue disappears into the log.** Today `close` pushes a whole `Tab`
into a ten-deep `closed` array that exists only so a tab can be reopened — undo for
exactly one operation, special-cased. It becomes two readers of one structure:

| Call | Becomes |
| --- | --- |
| `reopenClosed()` | invert the most recent `close` op |
| `undo()` | invert the most recent op of any kind |

`state.closed`, the `QUEUE` constant and the `closed` getter are all deleted.

### Why one writer matters

The log is only complete if nothing else mutates. So writes go through
`view-state`; reads may go anywhere. That is why `commands` takes `view-state`
rather than reaching for `tab-list` directly — a command that closes a tab has to
leave a trace, and the day a command inspects something it needs the same object
anyway.

## Across the wire — persistence, the same as everything else

A `view` capability with two procedures, each opening with `requireScope()` — which
already yields `{ projectId, userId, username }`, so neither takes a key as an
argument and neither can be asked for somebody else's row.

| Procedure | Does |
| --- | --- |
| `readViewState` | the `viewSnapshots` row for this scope, or nothing |
| `submitViewChanges` | append a `viewRevisions` row, replace the `viewSnapshots` row |

1. The layout builds the client model. `view-state` reads its row and restores
   tabs, rails, lenses and widths.
2. No row means a first visit: it lands on the singletons, exactly as it does
   today.
3. Every gesture applies immediately and buffers its op. Nothing waits on the
   network.
4. Either threshold fires — op count or debounce, both read from configuration at
   construction — and the buffer folds into one change set.
5. The change set goes up, the revision advances, and the snapshot row is replaced.
6. A failed submit keeps the buffer and reports it. Unsent work is never dropped.

Identical in shape to the three resource runtimes, minus what a single writer makes
unnecessary: no rebase ladder, no conflict, no `needs-review`. Two people cannot
both be editing one person's tab strip.

## The check that means something

After the model split, `pnpm test` is unchanged and no file under `views/` has been
edited. The surface was supposed to stay fixed; if a view had to change, it leaked.

Then: open some tabs, drag a flank, point the inspector at something, reload — and
find it all where you left it.
