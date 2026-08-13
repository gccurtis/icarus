# API: `setList`

Makes the lines a selection touches into list items. Unlike the style and link
methods, this one operates on complete logical lines: a selection touching any
part of a line affects the whole line, because a list marker belongs to a line
and not to a range of characters.

Markers and separators are display chrome. They are stored on the mark, derived
into `DisplayLine.list`, and never inserted into the text — so they cannot be
selected, edited, or counted in an offset.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`set-list.ts`](set-list.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision that issued the segment IDs. |
| `range` | `DisplayRange` | The selection. Expands to complete lines. |
| `presentation` | `ListPresentation` | Unordered with a marker string, or ordered with a starting integer. Both carry a separator. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-list-presentation` | The separator contains a newline; an unordered marker is empty or contains a newline; an ordered start is not a safe integer. |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `invalid-display-range` | A segment ID is unknown or from another revision, an offset is out of range or splits a character, or the range is reversed. |

An empty range is *not* an error here. A caret sitting in one line is a
meaningful request to make that line a list item.

## Effects

- Drops each selected line's existing list mark and adds one covering the whole
  line, all sharing a single `listId`.
- Marks on unselected lines are untouched.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. validateListPresentation(presentation) — before loading anything
  2. currentContent(store, contentId, expectedVersion)
  3. resolveSelectedLines(current, range)
     3.1. resolve both endpoints against the current revision
     3.2. reject a reversed range
     3.3. take the lines from the start line to the end line
          || the end sits at offset 0 of a later line
             3.3.a.1. exclude that line — the caller selected up to it, not into it
  4. setListMarks(current, lines, presentation, ids)
     4.1. choose the list ID:
          || a line immediately above or below carries a mark with the same
             presentation
             4.1.a.1. join that list
          || a selected line already carries a mark with the same presentation
             4.1.b.1. keep that list's ID
          || otherwise
             4.1.c.1. allocate a new list ID
     4.2. retain every mark not on a selected line
     4.3. add one ListItemMark per selected line, spanning the whole line,
          with a copied presentation
  5. commit(store, current, nextRevision(current, { marks }))
  6. return { contentId, version }
```

Step 3.3.a exists because a selection dragged from the end of one line to the
start of the next reads as one line to a user, not two.

Step 4.1 is what makes adjacent list items one list rather than several. It
matters for ordered lists, whose numbers are derived at render time by counting
consecutive lines sharing a `listId`: setting an ordered list over three lines
starting at 3 renders `3`, `4`, `5`.

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `validateListPresentation` | A marker or separator containing a newline would render as content the text does not contain. |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `resolveSelectedLines` | Expands a character selection to the complete lines it touches. |
| `setListMarks`, `copyListPresentation` | One mark per line, sharing a list ID, over a copy of the caller's presentation. |
| `rawLines`, `lineRange`, `listMarkForLine` (via `setListMarks`) | Derives line structure identically to the projection. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
