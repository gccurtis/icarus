# Comments API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the discussion on one thing, or across the project |
| [`start/`](start/start.md) | `start` | mutation — opens a thread with its first remark |
| [`reply/`](reply/reply.md) | `reply` | mutation — adds a remark |
| [`edit/`](edit/edit.md) | `edit` | mutation — rewrites one |
| [`resolve/`](resolve/resolve.md) | `resolve` | mutation — closes a thread |
| [`reopen/`](reopen/reopen.md) | `reopen` | mutation — says it is not settled |
| [`shared/`](shared/shared.md) | — | `requireThread`, which four of the five mutations start with |

## `resolve` and `reopen` rather than one `setStatus`

Each states one intent, which is also what makes its activity verb obvious —
`resolved`, `reopened`. A single function taking the status would have to say what
setting it to the value it already holds means, and that is the case where the
answer matters: re-resolving would overwrite who closed the thread, which is the
one fact the write exists to record.

## There is no `remove`

A thread is [resolved rather than deleted](../overview.md#resolved-rather-than-deleted),
and a function that deletes one would make that a matter of which button somebody
pressed.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). The target is always the thread
and the context is always what the thread is about, so the log reads without
opening the discussion.
