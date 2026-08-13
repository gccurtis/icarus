# API: `display`

Reads a content object and returns it as `DisplayContent`. This is the only way
to see content: every mutation returns an ID and a version, so a caller that
wants the result calls this afterwards.

It is also how a caller obtains the handles the mutating methods require. A
`DisplayRange` is built from segment IDs that only this method issues, and an
`AtomId` for `replaceText` comes from a segment too.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** accessor
- **Transaction:** none — a single read
- **Entry:** [`display.ts`](display.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `id` | `RichContentId` | The object to render. No expected version: the caller is asking what the current revision is. |

## Output

`DisplayContent` — the content ID, its current version, and its lines. Each line
carries an optional `list` (the marker and separator to render before it) and
its text segments. A segment is one run of text with one resolved style and one
set of active links, plus the atom handle and atom-relative range that
`replaceText` needs.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `content-not-found` | No object exists for that ID — including one consumed by `split` or `combineAsList`. |

## Effects

None. Nothing is written and nothing is cached; the projection is recomputed
from the stored revision on every call.

## Procedure Tree

```text
receive id
  1. requiredContent(store, id)
     1.1. store.find — a single SELECT
     1.2. translate the stored atoms, rewriting any retired "hard-break"
          discriminator as "line-break"
     || no row
        1.a.1. throw content-not-found
  2. renderDisplayContent(content)
     2.1. partition atoms into logical lines at line breaks
     2.2. for each line, resolve its list mark, if any
          || no mark, or a different list from the previous line
             2.2.a.1. restart the ordinal at 0
          || the same list continues
             2.2.b.1. advance the ordinal
     2.3. for each text atom, collect every style and link mark boundary
          falling inside it, and cut the atom into runs at those boundaries
          || the atom is empty
             2.3.a.1. emit one empty segment, so the line stays addressable
     2.4. for each run, resolve the style by applying every containing style
          mark in order over the defaults, and collect the deduplicated
          targets of every containing link mark
     2.5. stamp each line and segment with an ID containing the content version
  3. return { contentId, version, lines }
```

Step 2.5 is what makes handles safe. A segment ID contains the version that
produced it, so a mutation carrying a handle from an older revision cannot match
a segment and fails `invalid-display-range` instead of acting on text that has
since moved.

Step 2.2's ordinal is why an ordered list numbers correctly: markers are derived
from the presentation's `start` plus the count of preceding consecutive lines
sharing a `listId`, so numbering is never stored and never goes stale.

Step 2.3 is why a mutation can address any styled run: the boundaries that split
atoms into segments are exactly the mark boundaries, so every segment has a
single uniform style and link set.

## Supporting Procedures

None.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `requiredContent` | Reports an absent object as `content-not-found` rather than an empty projection. |
| `renderDisplayContent` | Builds the projection. It lives in `shared/` because `display-range.ts` uses it to resolve inbound handles — projecting and resolving must agree exactly, and they do so by being the same code. |
