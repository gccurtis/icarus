# Resource Sets API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's sets, as expressions |
| [`resolve/`](resolve/resolve.md) | `resolve` | query — what an expression selects right now |
| [`create/`](create/create.md) | `create` | mutation — names an expression |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces one |
| [`shared/`](shared/shared.md) | — | `requireSet`, which `revise` and `resolve` both start from |

## `resolve` takes an expression, not a set id

A scope may be written inline rather than referencing a saved set, and
`{ op: "set" }` is what connects the two. One function taking an expression is
therefore the whole surface: a separate `resolveSet` would be a second mechanism
for one question, and the inline form would have nowhere to go.

## `resolve` is a query, and reads far more than the others

It walks a key range per kind and one row per named ref, so it is the only
function here whose cost depends on the project rather than on the set. That is
the price of laziness and it is the right one: the alternative is a stored member
list that is wrong by the time anyone reads it.

Being a query rather than a mutation is the model, not an optimization — a
resolution is a point in time, so there is nothing to write, and Convex re-runs
it for every subscriber when anything it read changes.

## `list` resolves nothing

A list that answered "and here is what each of these currently holds" would walk
every table once per row. What a set selects is asked when something needs the
answer.

## Both mutations write an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md), like every other capability's.
