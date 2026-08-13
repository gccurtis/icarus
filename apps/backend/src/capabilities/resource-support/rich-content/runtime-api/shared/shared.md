# Rich Content Shared Procedures

A procedure belongs here once a second runtime-api method needs it, and only
when it preserves an invariant that spans those methods. It sits inside
`runtime-api/` rather than a capability-wide directory because it exists to
serve these methods, and both call trees stay visible through their imports.

Four procedures that might look like candidates are deliberately absent:
`createRawContent`, `replaceAtomText`, `splitRawContent`, and
`combineRawContentAsList` each have exactly one caller and live in that method's
directory instead.

## Procedures

| Procedure | Invariant it preserves | Used by | File |
| --------- | ---------------------- | ------- | ---- |
| `requiredContent` | A method never operates on a content ID that does not resolve. | every method except `create` | [revisions.ts](revisions.ts) |
| `currentContent` | A mutation acts only on the revision the caller expected. | every mutator except `create` | [revisions.ts](revisions.ts) |
| `nextRevision` | A successor revision advances the version by exactly one. | the eight in-place mutators | [revisions.ts](revisions.ts) |
| `commit` | A write happens only under a compare-and-swap. | the eight in-place mutators | [revisions.ts](revisions.ts) |
| `throwCommitConflict` | A lost race is reported as `stale-version`, never as success. | `commit`, `split`, `combineAsList` | [revisions.ts](revisions.ts) |
| `resultOf` | A mutation reports identity and revision, and nothing else. | every mutator | [revisions.ts](revisions.ts) |
| `renderDisplayContent` | Display Content is derived from the current revision, never stored. | `display`, `display-range.ts` | [render-display.ts](render-display.ts) |
| `resolveDisplayRange` / `resolveDisplayPosition` / `resolveSelectedLines` | A caller's handle is checked against the revision that produced it before it becomes a raw position. | `applyStyle`, `removeStyle`, `setLink`, `removeLink`, `setList`, `removeList`, `split` | [display-range.ts](display-range.ts) |
| `requireNonEmptyRange` | An inline mark is never created over an empty selection. | `applyStyle`, `removeStyle`, `setLink`, `removeLink` | [display-range.ts](display-range.ts) |
| `rawLines` / `lineRange` / `listMarkForLine` | Line structure is derived from atom order identically everywhere. | `render-display.ts`, `display-range.ts`, `list.ts`, `combineAsList` | [raw-lines.ts](raw-lines.ts) |
| `rawOffset` and the range comparisons | Two positions are ordered by absolute content offset, not by atom identity. | `display-range.ts`, `render-display.ts`, `mark-pieces.ts`, `style.ts`, `link.ts`, `split` | [ranges.ts](ranges.ts) |
| `markBefore` / `markAfter` | Removing a range from a mark keeps the parts outside it. | `style.ts`, `link.ts` | [mark-pieces.ts](mark-pieces.ts) |
| `validateStyle` / `addStyleMark` / `removeStyleProperties` | Only known style properties with well-typed values ever reach storage. | `applyStyle`, `removeStyle` | [style.ts](style.ts) |
| `validateAndCopyTargets` / `setLinkMark` / `removeLinksFromRange` | A stored link target is validated and copied, never aliased from the caller. | `setLink`, `removeLink` | [link.ts](link.ts) |
| `validateListPresentation` / `copyListPresentation` / `setListMarks` / `removeListMarks` | A list mark covers a complete logical line, and its presentation is a copy. | `setList`, `removeList`, `combineAsList` | [list.ts](list.ts) |

## Procedure: the revision discipline

`revisions.ts` is the reason no method directory talks to the store about
versions. `currentContent` refuses to return content whose stored revision is
not the one the caller named; `commit` refuses to write except through
`store.compareAndSwap`, which itself rejects any candidate that does not advance
the revision by exactly one.

**Preserves:** after `commit` returns, exactly one writer has advanced this
content object from `previous.version` to `previous.version + 1`.

**Fails when:** the content is absent (`content-not-found`), the stored revision
differs from the expectation (`stale-version`), or the conditional update
matched no row because another writer got there first (`stale-version`).

## Procedure: the display boundary

`renderDisplayContent` splits each text atom at every style and link boundary,
resolves the style and links active over each resulting run, and stamps each
line and segment with an ID containing the content version.

`display-range.ts` inverts that. It re-renders the current revision, finds the
segment the caller named, and maps the caller's offset to `atomRange.start +
offset`. Because segment IDs carry the version, a handle from an older revision
simply is not found.

**Preserves:** a caller can address content only through handles the current
revision issued, so no mutation acts on a position derived from stale text.

**Fails when:** the segment is unknown or the offset is out of range
(`invalid-display-range`, "invalid or stale"); the offset would split a
surrogate pair (`invalid-display-range`, "splits a character"); the range is
reversed; or, where a non-empty selection is required, the range is empty.

`render-display.ts` sits here rather than in `display/` because
`display-range.ts` depends on it: the projection is how a display handle is
resolved, not merely how content is shown.

## Procedure: the mark algebra

`ranges.ts` converts a `RawPosition` into an absolute offset by walking atoms —
text atoms contribute their length, line breaks contribute one — which is what
makes overlap, containment, and intersection well defined across atoms and
lines. `mark-pieces.ts` uses those comparisons to keep the head and tail of a
mark when its middle is removed, and `style.ts` and `link.ts` build on both.

**Preserves:** a mark is never silently truncated. Removing a range from a mark
either leaves the mark alone, splits it into the pieces outside the range, or
drops it entirely — and each surviving piece gets a fresh mark ID.

**Fails when:** a position names an atom that is not in the content, or an
offset outside that atom's text (`invalid-display-range`).
