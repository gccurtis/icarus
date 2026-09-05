# Activity

What happened in a project, in order. One append-only row per event.

```ts
interface Activity {
  projectId: Id<"projects">;
  actor: Actor;
  actorLabel: ActorLabel;      // resolved at write time
  verb: string;                // "created", "updated", "synced", "resolved"
  target: { type: string; id: string; label: string };
  context?: { type: string; id: string; label: string };
  detail?: string;
  at: number;
}

interface ActivityDigest {
  projectId: Id<"projects">;
  actorKey: string;
  verb: string;
  targetType: string;
  targetId: string;
  count: number;
  firstAt: number;
  lastAt: number;
}
```

## Why it exists

Once agents, automations, and connectors write to a project, the reasonable
question "where did this come from" stops having an obvious answer. Activity is
what makes an autonomous system explicable to the people whose project it is
acting on.

Connectors and external files are the sharpest case — files appearing without
anyone uploading them needs an accounting, and this is it.

## Labels are denormalized

`target` carries a `label` alongside the id. A feed entry has to read correctly
after its subject is deleted, and "deleted a document" with no name is not an
audit record.

It also means rendering a hundred feed entries is one query rather than a
hundred lookups across a dozen tables.

The label is a snapshot at the time of the event. If a document is renamed, past
entries keep the old name — which is right: they describe what happened, when it
happened.

## Actor, and the label beside it

`actor` is the shared [`Actor`](../core/actor.md) reference — an agent actor
points at its task, so "why did this change" is one hop from any entry it
produced, and a connector actor is how a surprising batch of files is traced to
the integration that brought them in.

`actorLabel` is the [resolved display
form](../core/actor.md#resolving-a-label), written at the same time. Activity is
the one place a label is stored rather than resolved, for the same reason
`target.label` is: a feed has to read correctly after its subject is gone, and
"deleted a document" attributed to a task that has since been cleaned up is not
an audit record.

For an agent that means the persona name and the task title are both frozen into
the entry — "Researcher · Q3 competitive scan" still reads years later, whether
or not either still exists.

## Context

`context` is the containing thing when the target has one — a comment's
document, a hypothesis's question. It lets a feed be filtered to one area of the
project without the reader having to know the shape of every target type.

## Append-only, and coarse

Rows are written and never updated or deleted. Activity is a log; an editable
log is not evidence of anything.

Not every mutation earns a row. Individual keystrokes, cursor movement, and
autosaves are not activity — a burst of editing is one `updated` event. The
`ActivityDigest` type is that rollup: repeated same-actor, same-verb,
same-target events collapse into a counted range, so a busy sync does not
produce a thousand rows that bury the one thing a person needed to see.

## Activity is not the undo log

Activity records *what was done*; [change sets](../revisions/change-set.md)
record *what changed*. They are not two views of one thing.

[Undo is per tab](../revisions/README.md#undo-is-per-tab) and applies to direct
manipulation only — a person inverting their own edit in an editor. It never
consults activity.

What activity is positioned for is the *other* affordance: reverting an action an
agent, automation, or connector took. That is a different thing with different
semantics — it is deliberate rather than reflexive, it can span objects, it needs
confirmation, and it is not something Ctrl-Z should ever reach. An entry that
named what it produced would be the handle for it.

Nothing is built for that yet and no field exists for it. It is noted here so the
two are not merged later on the assumption that they were always the same
feature.

## Not presence

Who is looking at what right now is not stored. It is ephemeral, it is wrong
within seconds of being written, and it belongs in a live channel rather than a
table.

## Related

[project](../core/project.md) · [connector](../special-resources/connector.md) ·
[agent task](../ai/agent-task.md) · [comment](comment.md)
