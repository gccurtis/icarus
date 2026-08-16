# Agent Tasks API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's tasks, by status or persona |
| [`read/`](read/read.md) | `read` | query — one task whole |
| [`dispatch/`](dispatch/dispatch.md) | `dispatch` | mutation — hands a goal to an agent |
| [`cancel/`](cancel/cancel.md) | `cancel` | mutation — stops one |
| [`shared/`](shared/shared.md) | — | `requireTask`, `asTask`, `moveTo`, and the five lifecycle steps |

## The public set is what a person does

Dispatching work and stopping it are decisions somebody makes. Running it is not:
`startRun`, `waitForInput`, `setPlan`, `completeTask`, and `failTask` are
promoted to [`shared/`](shared/shared.md) and registered nowhere, because a
client that could declare a task complete could put a fabricated deliverable
under its id and have the feed sign it with the agent's name.

## Nothing here reads or writes a message

A turn is `api.capabilities.messages.*` naming this task's id. The two
capabilities meet at `by_thread(("task", id))` and nowhere else, which is what
lets a task be dispatched, read, and stopped without touching a conversation.

`dispatch` is the one exception and only as a *check*: it reads the message it is
handed to prove that message is a turn of the chat it is handed.

## Four mutations write activity, and the runner's steps do not

`dispatch`, `cancel`, `completeTask`, and `failTask` call
[`record`](../../activity/api/shared/shared.md) inside the same transaction — an
entry cannot be missing from a write that happened.

`startRun`, `waitForInput`, and `setPlan` write none. They are a stream rather
than moments, and a feed entry per plan revision would bury the four a person
would actually want to read. What they changed is on the row, and why is in the
thread.
