# Messages API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one thread's turns, oldest first |
| [`post/`](post/post.md) | `post` | mutation — appends a turn |
| [`finish/`](finish/finish.md) | `finish` | mutation — closes a turn a responder was still producing |

## Every function names a thread, none names a chat

There is no conversation object to open before speaking and none to look up
afterwards. `list` takes a `ThreadRef`, `post` takes one, and `finish` needs
neither because the turn already carries it.

## There is no `shared/`

`requireMessage` sits in [`finish/`](finish/require-message.ts) because `finish`
is its only caller. Promotion means a procedure preserves an invariant spanning
functions; one used once is a supporting procedure of the function that uses it.

`list` has no id to check — it reads a range, and the range is already scoped.

## Nothing here edits or deletes

Turns are append-only. `finish` is the one write after a post and only while the
turn is `streaming`, which is not an exception: a turn opened before its content
exists is one append arriving in two parts. Changing a conversation is
[branching](../overview.md#append-only).

## Nothing here writes an activity entry

The one capability in this tree that does not, and
[`overview.md`](../overview.md#no-activity-entry) says why: a conversation is
already an append-only ordered log, and a second copy of it in the project feed
would drown the feed in the events that least need to be there.
