# Shared Findings Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-finding.ts`](require-finding.ts) | that a finding id names one in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireFinding`

`read` and `revise` both start with it, and it is promoted rather than copied
because it holds an invariant spanning them: the gate proves the caller holds *a*
project, and this is the only thing that proves the row is in it.

**It throws "not found", never "forbidden".** A finding in another project
answers exactly as one that never existed — telling them apart would confirm what
somebody else has established.

Its return type is the stored row: `revise` wants the `revision` it is about to
check, and `read` wants everything.
