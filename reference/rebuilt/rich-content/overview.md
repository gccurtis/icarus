# Rich Content

Canonical editable content for resource capabilities: ordered **atoms** with
**marks** laid over ranges of them.

Consumers never see either. They receive [`DisplayContent`](types/types.md) — a
derived, versioned projection with opaque handles — and hand those handles back.

| | |
| --- | --- |
| Alias | `$rich-content` |
| Server door | [`index.server.ts`](index.server.ts) |
| Browser door | [`index.ts`](index.ts) |
| Table | `rich_content` |
| Functions | eleven, in [`api/api.md`](api/api.md) |

## Atoms and marks, not nested spans

An atom is a run of text or a line break. A mark is a style, a link, or list
membership, laid over a **range** of atoms.

Marks may overlap freely — a bold span and a link span can cross without either
being split — which is what makes editing one of them not disturb the other.
[`render-display`](api/shared/render-display.ts) flattens them, once, on the way
out: segments are cut at every offset where formatting changes, so a segment's
style is uniform across its whole text.

Lines are derived from atom order and never stored. A line break is an atom, and
everything between two of them is one line.

## Raw Content stays private

**Neither door re-exports `RawAtom`, `RawMark`, `RawContent`, `RawPosition`,
`RawRange`, or `RawLine`.**

The ordinary reason is that they are a representation this capability reserves
the right to change. The stronger reason is that a consumer holding one could
construct a position the runtime never validated — an offset inside an atom that
does not exist, or one splitting a surrogate pair.

A two-door split makes it easy to widen a door by accident, which is why this is
stated here as well as in [`types/types.md`](types/types.md).

## Compare-and-swap is the correctness guarantee

Every mutation carries the revision the caller believes it is editing, and
[`revisions.ts`](api/shared/revisions.ts) is the only place that talks to the
database about versions. A function that bypassed it could commit a revision that
silently overwrote another writer's, and nothing downstream would notice.

Two functions replace whole objects rather than revising one, and both are
transactional:

- [`split`](api/split/split.md) — one object becomes two
- [`combineAsList`](api/combine-as-list/combine-as-list.md) — many become one

Their intermediate states are all wrong, so a reader must see the state before or
the state after and never a moment between.

## A handle is safe because it names a revision

Line and segment ids embed the content version. A handle taken from one revision
is simply not present in a later projection, so
[`display-range`](api/shared/display-range.ts) refuses it — which is how a stale
selection stops being usable without a separate check to remember.

That is also why [`display`](api/display/display.md) is the only function
returning content: one source for handles means one place that checks them.

## Browser reachability and admission

**All eleven functions have a `.remote.ts` and are reachable by a browser.** The
audit list is `api/*/*.remote.ts`.

A remote call is not unscoped: each wrapper resolves the project token it was
sent *within the asking session's user*, and one that does not resolve is a 404.
Below that line the token no longer exists and the procedure has a `Scope` it
cannot have been talked out of. Authentication and membership checking land on
`resolveScope` and change nothing here.

What each function owns is **validating what it receives**, because remotes are
declared `'unchecked'`. The checks that matter most are in `display-range.ts`,
since every position a browser sends comes through it.

## What `record` never writes

**Not one word of text.** Rich Content holds authored prose, and a log is copied,
shipped, and retained far longer than the content it describes. Records carry
identity, the revision a caller expected, and sizes — enough to reconstruct which
call happened and why it was refused, without reproducing what someone wrote.

## No size bounds, and that is a gap rather than a decision

Nothing limits how many atoms or marks one content object may hold, or how far a
single mark may span. A caller can grow one object until a query over it is slow
and the `jsonb` column is large.

The deleted backend carried a `rich-text.yaml` naming `maxAtomsPerContent: 10000`,
`maxMarksPerContent: 5000`, and `maxMarkRangeSpan: 1000` — and never read them
either. The file is gone rather than kept as configuration that looks live and is
not. If those bounds are wanted, they belong in admission here, checked where
`create`, `replaceText`, and the mark-adding functions build their successor
revision.

## Project isolation

Structural. A project is its own database, so no query carries a `project_id`
predicate and the table has no such column — which also repairs a latent defect:
the backend's table had no project column at all. See
[`persistence/persistence.md`](persistence/persistence.md).

## Translated from the backend

This capability was a runtime object over a store class, with an id factory
injected into it. It is procedural now: the object and the store are gone, the
store's four queries live in `api/shared/revisions.ts` beside the discipline they
serve, and ids are imported rather than injected. Every algorithm — the display
projection, range resolution, mark slicing, split, combine — moved unchanged.
