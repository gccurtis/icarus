# Shared Resource Set Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-set.ts`](require-set.ts) | that a set id names a set in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireSet`

[`revise`](../revise/revise.md) starts with it, and
[`resolve`](../resolve/resolve.md) lands on it at every `{ op: "set" }`. It is
promoted rather than copied because it holds an invariant spanning them: the gate
proves the caller holds *a* project, and this is the only thing standing between
a set reference and another project's material.

**It throws "not found", never "forbidden."** A set in another project answers
exactly as one that never existed, because distinguishing them would confirm the
set exists to someone with no right to know that.

Its return type is the stored row, deliberately: `revise` wants the revision it
is about to check and `resolve` wants the expression and the name, and the
conversion to `ResourceSet` belongs at the public boundary in `list`.
