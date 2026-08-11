# selection.ts

The **SelectionModel** — the pure translation from ProseMirror's selection to the inspector's
vocabulary (`SelectionInfo`). First extraction of workstream C, chosen first because it was
already almost pure: it only ever *read* the editor state.

## Everything here is a pure read

```ts
export function deriveSelection(
  state: EditorState,
  inspection: InspectionOverride | null
): DerivedSelection
```

No stores, no network, no runtime instance — a function of `(EditorState, inspection)`. That is
what makes the lenses testable: `selection.test.ts` builds an `EditorState` from an Omega
document and asserts the lens directly, where previously exercising a lens meant standing up a
whole `DocumentRuntime` and its network stack.

`InspectionOverride` today has exactly one producer: `actions.inspectBlock`, which always pins
`block`. The `blocks`/`row` variants (and `deriveSelection`'s handling of them) survive because
they mirror the frozen `SelectionInfo` vocabulary — but nothing has produced them since the
left-margin gutter was removed, and workstream D deleted the runtime's `inspectAnchor` (their
producer) along with the Row/Blocks lenses (UX1: editing must *feel* like a text editor — no
block-manipulation chrome; the block data model itself stays).

## The inspection side effect became a return value

```ts
export type DerivedSelection = {
  selection: SelectionInfo;
  clearInspection: boolean;
};
```

The runtime's original `deriveSelection` assigned `this.inspection = null` when a pinned
inspection stopped resolving (its blocks were deleted). A pure function cannot do that, so it
*reports* the condition and the runtime's four-line wrapper acts on it. This is the general
shape of the C extractions: the model computes, the orchestrator commits.

## The lens rules, in one place

`liveSelection` holds the routing that decides what the inspector shows:

- a `NodeSelection` on a block → the `block` lens (or `new-block` when it is an empty text block);
- an empty caret → `new-text`, but **only** in `text` and `callout` blocks — code, dividers, and
  images hold no formattable inline text, so they inspect as `block` rather than offering
  typography controls that could not apply;
- a non-empty range → `run`, carrying the text, char/word counts, the start block's sub-kind, and
  the mark state over the range.

The `run` branch collects `blockIds` **and** `rowIds` in a single walk. The rows are what
row-scoped controls (line spacing) write to — a run is the only mode that hands the panel no
`InspectedBlock`s to read a `rowId` from, which is bug **B1**; see `editor/session.ts`.

## blockPositionOf

```ts
export function blockPositionOf(doc: PmNode, blockId: string): number | null
```

An action handed a *block id* — an outline click, a row-child click — needs a document position
before it can build a transaction. It lives here rather than in `actions.ts` because it is the same
kind of pure document read as `blockAt`/`blocksById`, and because a pure function is testable:
`search.test.ts` pins both the hit and the `null` for a block that has been deleted.

## Mark state: range versus caret

`markState(doc, from, to)` answers "what formatting does this range carry" using
`rangeHasMark` plus a walk for the first link href and the inline font/fg/bg values.
`insertionMarkState(state)` answers the different question "what will the next typed character
carry", reading `storedMarks` (or the marks at the caret). Both produce the same
`TypographyState` shape, which is why one `TypographyControls` component serves Selected Text,
Next Text, and New Block without knowing which it is inside.
