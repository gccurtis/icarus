# Revisions API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`submit/`](submit/submit.md) | `submit` | mutation — accepts a change, or refuses it |
| [`shared/`](shared/shared.md) | — | `applyOps`, `invert`, and `shift` |

Registered in
[`src/convex/capabilities/revisions.ts`](../../../../convex/capabilities/revisions.ts).
`read` and `consolidate` arrive in task 10; `shared/` is exempt from the
correspondence between `api/` and the door, in both directions.

## Only `submit/` decides whether a change may apply

That is the [conflict ladder](../../../../../../docs/processes/change-conflicts.md),
and it is the whole reason this capability has a public write. Everything in
`shared/` executes a decision already made — which is why the only thing those
procedures refuse is an op that cannot be carried out at all.
