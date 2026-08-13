# API: `replaceText`

Replaces a range of canonical text inside one text atom. This is the only method
that changes canonical text; every other mutator changes marks and leaves the
text alone.

It is also the only mutator that addresses content by `AtomId` rather than by a
display range. An editor gets that atom ID, and the range within it, from
`TextDisplaySegment.atomId` and `.atomRange`.

## Classification

- **Owner:** `RichContentRuntime`
- **Execution:** mutator
- **Transaction:** none — a single conditional update
- **Entry:** [`replace-text.ts`](replace-text.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `contentId` | `RichContentId` | The object to edit. |
| `expectedVersion` | `number` | Must equal the stored revision. |
| `atomId` | `AtomId` | The text atom to rewrite. Must be a text atom, not a line break. |
| `range` | `AtomTextRange` | Half-open UTF-16 offsets within that atom. |
| `text` | `string` | The replacement. Must contain no newline. |

## Output

`ContentMutationResult` — the `contentId` and the committed revision.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `unsupported-text` | The replacement contains `"\n"`. Line structure is changed with `split` in this increment, not by inserting a break. |
| `content-not-found` | No object exists for `contentId`. |
| `stale-version` | The stored revision differs from `expectedVersion`, or another writer committed first. |
| `atom-not-found` | No atom in the content has that ID. |
| `invalid-atom-range` | The atom is a line break, or the offsets are non-integral, negative, reversed, past the atom's length, or would split a surrogate pair. |

## Effects

- Rewrites one text atom in place, keeping its ID.
- Moves every mark boundary the edit displaced.
- Advances the revision by one.

## Procedure Tree

```text
receive input
  1. currentContent(store, contentId, expectedVersion)
  2. replaceAtomText(current, input)
     2.1. reject a newline in the replacement
     2.2. find the atom by ID and require it to be a text atom
     2.3. validate the range, including surrogate-pair boundaries
     2.4. build the next atom text: prefix + replacement + suffix
     2.5. transform every mark boundary that lands in or after the edit
          || the boundary is at or before the replaced start
             2.5.a.1. leave it alone
          || the boundary is at or after the replaced end
             2.5.b.1. shift it by (inserted length - replaced length)
          || the boundary is inside the replaced range
             2.5.c.1. collapse it to the start, or to the end of the insertion,
                      according to which edge it is
          || the mark is a list item covering exactly this atom
             2.5.d.1. re-span it over the whole new text
  3. commit(store, current, nextRevision(current, replacement))
  4. return { contentId, version }
```

The atom keeps its ID because a surviving atom keeps its identity across an
edit. That is what lets an editor hold an atom handle across a keystroke. The
list-item branch exists so a list marker still covers its whole line after the
line's text grows or shrinks.

## Supporting Procedures

| Procedure | Responsibility | File |
| --------- | -------------- | ---- |
| `replaceAtomText` | Validates the edit and produces the next atoms and marks. | [replace-atom-text.ts](replace-atom-text.ts) |

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `currentContent` | Refuses to edit a revision the caller did not expect. |
| `nextRevision`, `commit` | Advances the revision by exactly one under a compare-and-swap. |
