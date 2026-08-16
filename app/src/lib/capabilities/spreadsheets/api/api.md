# Spreadsheets API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's workbooks |
| [`create/`](create/create.md) | `create` | mutation — starts one |
| [`rename/`](rename/rename.md) | `rename` | mutation — retitles one |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes one |
| [`shared/`](shared/shared.md) | — | `requireSpreadsheet`, which `rename` and `remove` start with |

## Four functions, and none of them touch a sheet

`rename` retitles the *workbook*. Renaming a sheet, adding one, hiding one, and
setting a cell are all `revisions.submit`, because all four are edits to the body
and every one of them is something a person expects to undo.

That is the same division documents and decks make, and it is why the surface
here is small rather than incomplete.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md).
