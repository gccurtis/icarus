# Questions API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's questions, or one's children |
| [`ask/`](ask/ask.md) | `ask` | mutation — writes one down |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces the draft |
| [`set-status/`](set-status/set-status.md) | `setStatus` | mutation — says where it stands |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes it |
| [`shared/`](shared/shared.md) | — | `requireQuestion` and `resolveParent` |

## `setStatus` is separate from `revise`

Two intents rather than one `update`: the status is a click from a list and the
draft is a form. That difference is also what decides which one takes a revision
— see [`revise`](revise/revise.md).

## `remove` is a real function here

Elsewhere in the project a thing is archived or resolved. A question is deleted,
because the model has no status meaning "we are not doing this" and absence is
the honest signal.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
