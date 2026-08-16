# Documents API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's documents |
| [`create/`](create/create.md) | `create` | mutation — starts one |
| [`rename/`](rename/rename.md) | `rename` | mutation — retitles one |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes one |
| [`shared/`](shared/shared.md) | — | `requireDocument`, which `rename` and `remove` start with |

## Four functions rather than one `update`

The row holds one editable field, so a general `update` would be `rename` with a
name that hides what it does — and it would have to say what an absent field
means. Each mutation here states one intent, which is also what makes its
activity verb obvious: `created`, `renamed`, `deleted`.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not, which is what makes the
log evidence rather than a report.
