# Workbench

What is open, which one is active, and what is selected in each.

The coordinating state every zone reads and writes: the tab strip renders it, the
work surface fills from it, and the context and inspector panels project over it.
Named for the frame rather than for tabs, because the tab list is only its most
visible part — and because `session` collided with an authentication session.

## Invariants

- **A permanent tab cannot be closed or reordered.** It is constructed with the
  runtime, which is what makes the next invariant true rather than hoped for.
- **`activeId` is never empty.** Something is always open, so no caller needs an
  "if nothing is open" branch.
- **Permanent tabs hold the leading positions**, so the transient ones a user can
  drag are always a contiguous run at the end. `reorder`'s index counts transient
  tabs only, and is offset past that prefix.
- **Closing the active tab selects right, then left.** After the splice the
  element now *at* the removed index is the one that was to the right; a
  permanent tab always survives, so this cannot fall through to nothing.
- **`reorder` clamps rather than throwing.** A drag past either end is an
  ordinary gesture, not a caller error.

Each of these was guaranteed only by prose before this object moved. They have
tests now, because a refactor that broke one would otherwise have gone unnoticed
until the shell was wired.

## The id counter is an instance field

It was module scope before the move, and it is not user data, so it reads as
harmless — which is exactly why it was the thing most likely to be carried across
untouched. One counter per process mints ids for every user at once, so two
users' tabs interleave and an id stops being reproducible from a fresh boot.

## Restoring is the same path as opening

Stored tabs replay through `open()`. That is deliberate rather than convenient:

- `open` already dedupes on kind and id, so a stored duplicate of the permanent
  tab collapses into it instead of appearing twice.
- Ids are minted fresh. A stored id would be meaningless on this boot, and a
  restored `tab-1` colliding with one the counter is about to mint would make
  lookups return the wrong tab.
- The permanent tab is reconstructed, never stored, so it cannot arrive twice or
  arrive wrong.

**A stored kind is checked before it is trusted.** `ACTIVITIES` is a
`Record<ResourceKind, …>`, so a kind written by an older build resolves to
`undefined` and throws during paint. `RESOURCE_KINDS` exists as a value for
exactly this — the type is derived from it, so the two cannot drift — and
`isResourceKind` drops what no longer exists.

The active tab is stored as a **ref, not an index**, so a dropped tab cannot
silently activate its neighbour. A ref matching nothing leaves whatever the last
`open` activated, which is always valid.

## What is not persisted

`inspection` and `scrollTop`. An inspection names block ids and character offsets
in a document that may have changed since, so restoring it would be wrong as well
as unbounded. `TabOptions`' own comment says what dies with the tab; this is that
line, enforced.

`update()` therefore writes only when `activityId` changes. Persisting on every
caret move would be a write per keystroke-adjacent action.
