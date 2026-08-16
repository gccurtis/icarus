# Persona Threads API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's chats, or one persona's |
| [`read/`](read/read.md) | `read` | query — one thread |
| [`start/`](start/start.md) | `start` | mutation — opens one with a persona |
| [`branch/`](branch/branch.md) | `branch` | mutation — continues from an earlier message |
| [`rename/`](rename/rename.md) | `rename` | mutation — retitles one |
| [`shared/`](shared/shared.md) | — | `requireThread` and `asThread` |

## Nothing here reads or writes a message

A turn is `api.capabilities.messages.*` naming this thread's id. The two
capabilities meet at the index and nowhere else, which is what lets a chat be
opened, read, branched, and renamed without touching a conversation.

`branch` is the one exception and only as a *check*: it reads the message it is
handed to prove that message is a turn of the thread it is handed.

## `rename` rather than `revise`

The title is the only thing on this row that can change. The persona is who the
conversation is with and `branchedFrom` is where it came from — changing either
would make the thread a different one wearing somebody else's history.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
