# Shared Hypotheses Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`require-hypothesis.ts`](require-hypothesis.ts) | that a hypothesis id names one in the caller's project, and that a caller learns nothing from the answer when it does not |

## `requireHypothesis`

`revise` and `assess` both start with it, and it is promoted rather than copied
because it holds an invariant spanning them: the gate proves the caller holds *a*
project, and this is the only thing that proves the row is in it.

**It throws "not found", never "forbidden".** A hypothesis in another project
answers exactly as one that never existed — telling them apart would confirm what
somebody else believes might be true.

Its return type is the stored row: both callers want the `revision` they are about
to check and the `statement` they are about to log.
