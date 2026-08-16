# Revisions API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`shared/`](shared/shared.md) | — | `applyOps`, `invert`, and `shift` |

## No registered function yet, and so no deployment door

`read`, `submit`, and `consolidate` arrive in task 10. Until then this directory
holds only procedures they will all call, and a door registering nothing would
say less than its absence does: what an untrusted caller can reach here is
nothing.

`shared/` is exempt from the correspondence between `api/` and the door in both
directions, and that includes whether the door has to exist at all.

## Nothing here decides whether a change may apply

That is the [conflict ladder](../../../../../../docs/processes/change-conflicts.md),
and it lands in `submit/` in task 9. These procedures execute a decision already
made — which is why the only thing they refuse is an op that cannot be carried
out at all.
