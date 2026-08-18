# Shared Copilot Methods

Lives at `methods/shared/shared.md`.

Two identity rules, each preserving an invariant that spans its callers.

| File | Callers | Invariant it preserves |
| --- | --- | --- |
| [`same-selector.ts`](same-selector.ts) | `include`, `exclude`, `drop-selector` | A selector is in one list, the other, or neither |
| [`same-attachment.ts`](same-attachment.ts) | `attach`, `detach` | One attachment per thing pointed at |

## `same-selector`

**Identity, not deep equality.** A `part` selector compares on its ref and its
scope path and *not* on its label: two selectors on one path are the same
selector even if the label was regenerated, and comparing labels would make
`dropSelector` unable to find the chip the user is clicking.

The three writers must agree exactly, because the invariant they hold between
them — a selector is in `include`, in `exclude`, or in neither — is only as good
as the comparison each uses to decide which list it is already in.

## `same-attachment`

By kind and id, which is what makes `attach` idempotent: pointing at the same
document twice is one chip.

A link is identified by its **URL**, not by its fetch result. The same URL
fetched twice is one attachment — the second attempt may have succeeded where the
first failed, and replacing rather than appending is what lets a retry update the
chip in place.
