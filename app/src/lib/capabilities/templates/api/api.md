# Templates API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the templates this project may start from |
| [`create/`](create/create.md) | `create` | mutation — defines one |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces one |
| [`instantiate/`](instantiate/instantiate.md) | `instantiate` | mutation — makes a resource from one |
| [`remove/`](remove/remove.md) | `remove` | mutation — deletes one |
| [`shared/`](shared/shared.md) | — | `requireTemplate` and `requireOwnTemplate`, which the last three start with |

## `revise` replaces rather than patches

A template has no partial edit. Its parts are a name, a description, a body, and
a slot list, and changing the body is the ordinary case — so a patch would have to
say what an absent field means, and either answer ("unchanged", "cleared") is
wrong half the time. Replacing states the whole intent, and `revision` is what
makes replacing safe.

## `instantiate` is here rather than on the resources

Three capabilities would otherwise each need a `createFromTemplate`, each reading
this table and each free to disagree about what a copy is. One function that
reads the template and dispatches on its target keeps the copy rule in one place —
and it still writes nothing itself, handing the body to the resource capability
that owns the row.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). `instantiate` writes one of its
own beside the resource's `created` entry, because "which template was this made
from" is the question that entry cannot answer and the row's `templateId` stops
answering once the template is deleted.
