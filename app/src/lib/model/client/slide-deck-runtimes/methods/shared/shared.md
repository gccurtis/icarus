# Shared Slide Deck Runtime Methods

Lives at `methods/shared/shared.md`.

Two steps, each preserving something that spans the methods using it.

| File | Callers | Invariant it preserves |
| --- | --- | --- |
| [`detach.ts`](detach.ts) | `release`, `release-all` | A runtime leaves `open` before anything else happens to it |
| [`empty-body.ts`](empty-body.ts) | `attach` | A deck the store has never held still opens on something |

## `emptyBody`

One blank slide, not zero. A deck with no slides has nothing to draw and nothing
to select, so it is indistinguishable on screen from a deck that failed to load —
and the two want opposite responses from whoever is looking at it.

Ids are minted here rather than taken from the store, because a body that has
never been written has no ids to take.

## `detach`

The order is the invariant. The entry leaves `open` **first**, so a second
release finds nothing and cannot submit the same buffer twice. That is why there
is no released-set to maintain: the map is the record.

The subscription is dropped here rather than after the submit settles, because a
detached runtime must stop accepting new bodies at once — a body arriving
mid-flush would re-render a surface that is on its way out.
