# Rich Content Shared Procedures

Nine files. This is the bulk of the capability: the eleven function entries are
mostly short, and the algorithms they compose live here.

| Procedure | Invariant it preserves | Used by | File |
| --- | --- | --- | --- |
| revision discipline | only one writer wins a revision | all eleven | [revisions.ts](revisions.ts) |
| `render-display` | the projection is derived, never stored | display, display-range | [render-display.ts](render-display.ts) |
| `display-range` | a position a caller sends is real, current, and whole | eight mutators | [display-range.ts](display-range.ts) |
| `ranges` | two positions are compared one way | ranges, marks, split | [ranges.ts](ranges.ts) |
| `raw-lines` | a line is derived from atom order | render, list, combine | [raw-lines.ts](raw-lines.ts) |
| `mark-pieces` | a cut mark leaves correct, newly-identified halves | style, link | [mark-pieces.ts](mark-pieces.ts) |
| `style` | a style is admitted, layered, and removable per property | applyStyle, removeStyle | [style.ts](style.ts) |
| `link` | a link is admitted, copied, and replaces rather than layers | setLink, removeLink | [link.ts](link.ts) |
| `list` | list membership is per line, and adjacent lists join | setList, removeList, combineAsList | [list.ts](list.ts) |
| `ids` | every identifier is self-describing | seven of them | [ids.ts](ids.ts) |
| `record` | every call leaves one trace, classified | all eleven | [record.ts](record.ts) |
| `stated` | a refusal reaches the browser; a fault does not | the eleven wrappers | [stated.ts](stated.ts) |

## `revisions.ts` — the correctness of the capability

**A function that bypassed this file could commit a revision that silently
overwrote another writer's**, and nothing downstream would notice. That is why no
function directory talks to the database about versions itself.

```ts
loadContent(database, id)                        // read, or undefined
requiredContent(database, id)                    // read, or content-not-found
currentContent(database, id, expectedVersion)    // read, or stale-version
nextRevision(content, changes)                   // version + 1
commit(database, previous, candidate)            // CAS, or stale-version
replaceOneWithTwo(database, original, l, r)      // split's transaction
replaceManyWithOne(database, originals, one)     // combine's transaction
```

**Preserves:** a write lands only if the revision it was computed from is still
the revision in the database.

`compareAndSwap` asserts the candidate advances the revision by exactly one. That
is a bug in the caller rather than a condition to report, so it throws a plain
`Error` rather than a stated code — a candidate that skipped a revision would
write a version a concurrent reader could already hold, and the
`where revision = expected` predicate would still match.

**The two transactions are not optional.** Both of `split`'s intermediate states
are wrong — the original deleted with no replacements, or two replacements
alongside an original that still exists — so a reader must see one or the other
and never a moment in between. `combineAsList` deletes every source at the
revision the caller expected, so a combine over a stale subset abandons rather
than silently discarding another writer's work.

`CasConflict` is private and exists only to force a rollback: Kysely rolls back
when the callback throws, and there is no other way to abandon a transaction
partway. It is caught at each transaction's boundary and turned back into
`false`, so it never escapes this module.

## `display-range.ts` — the only inbound crossing

Every position a browser sends comes through here. A caller names segments and
offsets; it never names an atom.

**Fails when:** the segment id is not in the current projection — which covers
*stale* and *invented* with one check, because segment ids embed the version they
were rendered at; the offset is not an integer, is negative, or is past the end
of its segment; the offset splits a surrogate pair; or the range is reversed.

A reversed range is refused rather than normalized. A caller sending end before
start has a bug, and swapping them would hide it and edit somewhere plausible.

## `render-display.ts` — derived, never stored

Marks are overlapping ranges in storage, which is what lets a bold span and a
link span cross without either being split. This flattens them, once, on the way
out: segments are cut at every offset where formatting changes, so a segment's
style is uniform across its whole text — the property a renderer relies on.

Later marks win, which is why `applyStyle` appends rather than merges.

## `ids.ts`

`contentId`, `atomId`, `markId`, `listId`, over `crypto.randomUUID()` with the
prefixes `content_`, `atom_`, `mark_`, `list_`.

Imported rather than injected. The backend passed a factory into a runtime object
so a test could substitute a counter; there is no object to inject into now, and
a test that genuinely needs stable identity mocks this module. Most do not — an
assertion on `content-1` was usually testing the fixture rather than the
capability.

## `record.ts`

```ts
export const record = async <T>(
  operation: string,
  fields: Record<string, unknown>,
  run: () => Promise<T>
): Promise<T> => ...;
```

**Records:** `rich-content.<operation>.started` on entry, `.completed` on
success, `.rejected` or `.failed` on the two kinds of failure.

**Never records text.** Not a word of it. Rich Content holds authored prose, and
a log is copied, shipped, and retained far longer than the content it describes.
What goes in a record is identity, the revision a caller expected, and sizes —
enough to reconstruct which call happened and why it was refused, without
reproducing what someone wrote.

**Classifies:** a `RichContentError` is a decision this capability stated and is
logged at `warn` with its code; anything else is a fault and is logged at
`error`.

## `stated.ts`

Translates a `RichContentError` into a `400` carrying its code, and lets a fault
stay an opaque `500`. **Only the eleven remote wrappers call it** — a server-side
caller catches the error class directly and has no use for an HTTP status.
