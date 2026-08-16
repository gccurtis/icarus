# Research Threads API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's threads, or one question's |
| [`read/`](read/read.md) | `read` | query — one thread |
| [`start/`](start/start.md) | `start` | mutation — opens one |
| [`revise/`](revise/revise.md) | `revise` | mutation — restates what it is working on |
| [`shared/`](shared/shared.md) | — | `requireThread`, `requireAnchor`, `asThread` |

## Nothing here reads or writes a message

A turn is `api.capabilities.messages.*` naming this thread's id. The two
capabilities meet at the index and nowhere else, which is what lets a thread be
started, read, and re-anchored without touching a conversation.

## `list` and `read` return the same shape

Unusually — and correctly. There is no heavier half to withhold: the substance of
a thread is its messages, and those are a separate read against a separate table.
`read` exists so a thread can be opened by its own address without listing the
project first.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
