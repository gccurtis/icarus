# Name Manager API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's vocabulary, in definition order |
| [`define/`](define/define.md) | `define` | mutation — names a value |
| [`remove/`](remove/remove.md) | `remove` | mutation — frees a name |
| [`shared/`](shared/shared.md) | — | `canonicalName`, `findVariable`, `asVariable` |

## Three functions, and no `get`

A caller that needs one variable holds the list, and a caller that needs to
*resolve* a name is [`formula`](../../formula/overview.md), which calls
`findVariable` inside the same transaction rather than over the wire. A public
`get` would be a second, slower way to ask the question the list already
answered.

## `define` and `remove` write an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). `remove` reads the name before
deleting the row, so the entry can still say what went.
