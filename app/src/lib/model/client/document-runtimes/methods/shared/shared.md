# Shared Document Runtime Methods

Lives at `methods/shared/shared.md`.

One step, preserving an invariant that spans the methods using it.

| File | Callers | Invariant it preserves |
| --- | --- | --- |
| [`detach.ts`](detach.ts) | `release`, `release-all` | A runtime leaves `open` before anything else happens to it |

## `detach`

The order is the invariant. The entry leaves `open` **first**, so a second
release finds nothing and cannot submit the same buffer twice. That is why there
is no released-set to maintain: the map is the record.

The subscription is dropped here rather than after the submit settles, because a
detached runtime must stop accepting new bodies at once — a body arriving
mid-flush would re-render a surface that is on its way out.
