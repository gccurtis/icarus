# Shared Documents Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-document.ts`](require-document.ts) | that a document id names a document in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireDocument`

`rename` and `remove` both start with it, and it is promoted rather than copied
because it holds an invariant spanning them: the gate proves the caller holds *a*
project, and this is the only thing that proves the row is in it.

**It throws "not found", never "forbidden".** A document in another project
answers exactly as one that never existed. Distinguishing them would confirm the
document exists to someone with no right to know that — the same refusal `access`
makes when a token resolves to nobody's project.

Its return type is the stored row, which is deliberate: its callers are inside
this capability and want the fields they are about to patch or log, and the
conversion to `Document` belongs at the public boundary in `list`.
