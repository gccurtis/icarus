# Slide Decks API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's decks |
| [`create/`](create/create.md) | `create` | mutation — starts one |
| [`rename/`](rename/rename.md) | `rename` | mutation — retitles one |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes one |
| [`shared/`](shared/shared.md) | — | `requireDeck`, which `rename` and `remove` start with |

## The same four as documents, for the same reason

The row holds one editable field, so a general `update` would be `rename` under a
name that hides what it does. Everything else about a deck — adding a slide,
moving an element, recolouring the theme — is `revisions.submit`, because all of
it is content and all of it must be undoable.

`aspectRatio` is the one field that is neither: it is set at creation and never
edited, so it is an argument to `create` and appears in no other function.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
