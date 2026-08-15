# API: `setList`

Makes the lines a display selection touches into list items.

## Classification

- **Effect:** mutator
- **Transaction:** none — one compare-and-swap
- **Entry:** [`set-list.ts`](set-list.ts)
- **Browser-reachable:** yes, via [`set-list.remote.ts`](set-list.remote.ts) — a `command`

## Signature

```ts
export const setList = async (
  scope: Scope,
  input: SetListInput
): Promise<ContentMutationResult>;
```

## Lines, not a range

A list marker belongs to a whole line, so the selection is widened to every line
it touches — `resolveSelectedLines` rather than `resolveDisplayRange`.

**A selection ending exactly at the start of a line does not include that line.**
Dragging to the beginning of the next line is not a request to make it an item,
and treating it as one is the kind of off-by-one a person notices immediately.

## Adjacent matching lists join

If the line above or below already carries a list with the same presentation,
these lines take that list's id rather than starting a new one.

That is what makes ordered numbering continue instead of restarting at the start
value — `render-display` restarts the ordinal only when the list id changes.
Without the join, extending a list would silently renumber it.

## A marker containing a line break is refused

A line break is an **atom** here. One appearing in a rendered marker would put a
line boundary where the atom sequence says there is none, and every range
computed afterwards would disagree with what a reader sees.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-list-presentation` | a separator or marker containing a line break, an empty marker, or a non-integer start |
| `content-not-found` | no content object has that id |
| `stale-version` | the content moved under the caller |
| `invalid-display-range` | the selection is stale, invalid, splits a character, or is reversed |

## Procedure Tree

```text
setList(scope, input)
├── record("setList", { contentId, kind })                 ../shared/record.ts
├── validateListPresentation(input.presentation)           ../shared/list.ts
├── projectDatabase(scope.projectId)                       $model/server/index.server
├── currentContent(database, contentId, expectedVersion)   ../shared/revisions.ts
├── resolveSelectedLines(current, input.range)             ../shared/display-range.ts
│   └── rawLines(content)                                  ../shared/raw-lines.ts
├── setListMarks(current, lines, presentation)             ../shared/list.ts
│   ├── listMarkForLine / lineRange                        ../shared/raw-lines.ts
│   ├── join a neighbouring list, or listId()              ../shared/ids.ts
│   └── copyListPresentation(presentation)                 ../shared/list.ts
├── nextRevision(current, { marks })                       ../shared/revisions.ts
└── commit(database, current, candidate)                   ../shared/revisions.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `list` | `setList`, `removeList`, and `combineAsList` must agree on what list membership is |
| `raw-lines` | a line is derived from atom order, in one place |
| `display-range` | every position a browser sends is checked in one place |
| `revisions` | the revision gate and the compare-and-swap |
