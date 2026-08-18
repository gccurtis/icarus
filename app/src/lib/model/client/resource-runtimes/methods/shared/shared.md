# Shared Resource Runtime Methods

Lives at `methods/shared/shared.md`.

Two steps, each preserving an invariant that spans the methods using it.

| File | Callers | Invariant it preserves |
| --- | --- | --- |
| [`runtime-key.ts`](runtime-key.ts) | `attach`, `release` | One resource, one key |
| [`detach.ts`](detach.ts) | `release`, `release-all` | A runtime leaves `open` before anything else happens to it |

## `runtime-key`

`attach` and `release` have to agree on a key exactly. Two spellings of the same
resource is two runtimes for one resource, which is the single thing this object
exists to prevent — and it would fail silently, as a second buffer submitting
against a revision the first one already moved.

## `detach`

The order is the invariant. The entry leaves `open` **first**, so a second
release finds nothing and cannot submit the same buffer twice. That is why there
is no released-set to maintain: the map is the record.

The subscription is dropped here rather than after the submit settles, because a
detached runtime must stop accepting new bodies at once — a body arriving
mid-flush would re-render a surface that is on its way out.
