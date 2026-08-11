# A2 design spec + backend requests (block kinds, lists, typography defaults)

Pre-implementation design for the **A2** document slice — adding structural block
kinds and redesigning the inspector — plus the backend requests the design surfaced.
No product code yet; this is the approved design and the tracked gaps it depends on.
Design was done collaboratively (brainstorming) and settled several forks:
quote is dropped as an offered kind, lists defer to a native `list` kind, indent is a
general text property (not a list one), and the Layout panel's rejected semantic
controls are removed now with real-font defaults deferred.

## A2 design spec

```
docs/superpowers/specs/2026-07-25-a2-block-kinds-design.md
```

The approved design: taxonomy (**Text type** = Body + Heading 1–6, converted whole-line
via `set_block`; **Insert element** = Divider, Code, Callout via `insert_block`), a
`block-kinds.ts` single-source-of-truth registry, a **hybrid** ProseMirror schema
(reuse the paragraph node for callout/quote; new `code_block` + `divider` nodes), the
bridge rules, the runtime actions (`setTextType`, `insertElement`), the inspector
redesign (Insert element; `new-block` with full next-text typography; a collapsible
**Extra formatting** section with Text type + Line spacing), the Layout cleanup, and a
three-commit staging plan. Written because A2 is large and forked on real decisions
(the block data model, list model, and typography defaults) that needed to be settled
and recorded before code.

## Backend request — a `list` block kind + a general text indent level

```
docs/backend-requests/list-block.md
```

Requests a native **`list` block kind** (one element that holds its items internally,
matching how users think of a list) and a **general `indent` level** on `BlockStyle`
(indent is a text-type property, not a list one). Filed because Omega today has only
flat `list_item` (one block per line) with no op to mutate its data after insert, and
no block carries an indent — so the cockpit's list element and indent control can't be
built faithfully yet. A2 defers both rather than ship a flat approximation.

## Backend request — document & per-kind typography defaults (+ terminology)

```
docs/backend-requests/typography-defaults.md
```

Requests real-font **defaults** — a document default font and per-kind (body/heading)
real typography — plus the `paragraph`↔`body` naming alignment and a possible `text`
kind with text sub-kinds. Filed because custom typography (real fonts) is **per-block
only** in Omega; style definitions carry only semantic tokens and there is no
document/kind-level default font. This is why the A2 Layout cleanup removes the
semantic controls now and restores real ones only when this lands.

## Gap list + request index updates

```
docs/backend-requests/alpha-remaining-gaps-2026-07-25.md   # +G5 (list/indent), +G6 (typography defaults); "six items"
docs/backend-requests/README.md                            # +list-block, +typography-defaults rows
```

Recorded the two new gaps (G5, G6) in the short backend-TODO and indexed both requests
in the requests README, so the Omega side has a single prioritized list to build
against and the cockpit tracks what each unblocks.
