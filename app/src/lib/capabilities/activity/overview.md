# Activity

What happened in a project, in order. One append-only row per event, and the
answer to "where did this come from" once agents, automations, and connectors
write to a project too.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | one project's log, newest first |

Registered in
[`src/convex/capabilities/activity.ts`](../../../convex/capabilities/activity.ts).

**`record` is deliberately not registered.** It is called by the capability that
did the thing, inside the same mutation, so an entry cannot be missing from a
write that happened or present for one that did not. A log a client can append to
is not evidence of anything — so it lives in
[`api/shared/`](api/shared/shared.md), which is where a procedure other functions
call rather than callers do belongs.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `activity` | one row per event: who acted, what they did, to what, and when |

## Capability Invariants

- **Rows are written and never updated or deleted.** An editable log is not
  evidence. Nothing here patches, and there is no `remove`.
- **`at` is stamped by `record`**, and an `at` a caller passes is ignored. A log
  whose timestamps come from whoever is writing can be backdated.
- **A resolvable label is resolved by `record`**, and one a caller passes for
  those kinds is ignored too. `user`, `system`, and `agent` are every kind whose
  table exists today; `automation` and `connector` arrive in pass 8 and must
  carry their label until then, and an entry with no legible actor is refused
  rather than written blank.
- **An agent's label is three fields**, resolved from its
  [task](../agent-tasks/overview.md): the persona's name, the dispatching user as
  `onBehalfOf`, and the task's title as `detail`. Naming the dispatcher for
  display changes nothing about attribution — the actor is still the task.
- **Labels are snapshots, not references.** A renamed document keeps its old name
  in past entries, which is right: they describe what happened when it happened.
- **Not every mutation earns a row.** A burst of editing is one `updated` event,
  not a thousand — keystrokes and autosaves are change sets, not activity.

## It is not the undo log

Activity records *what was done*; [change sets](../../../../../docs/data-models/revisions/change-set.md)
record *what changed*. Undo is per tab, applies to direct manipulation only, and
never consults this table. Reverting what an agent did is a different affordance
with different semantics, and nothing is built for it yet.

## Related

[activity](../../../../../docs/data-models/collaboration/activity.md) — the model
this implements · [actor](../../../../../docs/data-models/core/actor.md) — the
label resolution table
