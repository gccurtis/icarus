# Actor

Who did something. One type, used everywhere a change, a creation, or an event
needs attribution.

```ts
type Actor =
  | { kind: "user"; userId: Id<"users"> }
  | { kind: "agent"; taskId: Id<"agentTasks"> }
  | { kind: "automation"; automationId: Id<"automations"> }
  | { kind: "connector"; connectorId: Id<"connectors"> }
  | { kind: "system" };

interface ActorLabel {
  kind: Actor["kind"];
  name: string;                // who acted
  onBehalfOf?: string;         // who asked for it — agents only
  detail?: string;             // what they were doing — agents only
}

type Mention =
  | { kind: "user"; userId: Id<"users"> }
  | { kind: "persona"; personaId: Id<"personas"> }
  | { kind: "task"; taskId: Id<"agentTasks"> };
```

## One type, not one per consumer

A [change set](../revisions/change-set.md), an
[activity](../collaboration/activity.md) entry, an [agent
task's](../ai/agent-task.md) origin, and a document's `createdBy` are all asking
the same question. Before this they each answered it with their own union,
differing by a case or two — which is how "who edited this" and "who is shown in
the feed" quietly become different answers to the same question.

The five kinds are the complete set of things that can act. Anything new that
acts is a new kind here, added once.

## Agent actors point at the task

Not at the persona, and not at both. A [task](../ai/agent-task.md) already
carries its `personaId`, so persona is one hop away, and storing both would
allow them to disagree — a task whose persona was reassigned would have two
answers about who ran it.

The task is also the more specific truth. "The Researcher persona" did not edit
this paragraph; a particular run of it did, and that run has a goal, a message
log, and a plan explaining why.

## The user behind an agent is not the actor

A task dispatched by a person records that person in its own
[`origin`](../ai/agent-task.md#origin). It does not make them the actor of the
task's changes.

This matters for [undo](#undo-scopes-on-the-actor): work I asked an agent to do
is not work I did, and reaching for Ctrl-Z should not silently revert a hundred
edits an agent made on my behalf. Reverting that is a
[deliberate action](../collaboration/activity.md#activity-is-not-the-undo-log),
not a reflex.

## System has no id

`system` is a singleton — migrations, scheduled maintenance, cleanup. It carries
no identifier because there is nothing to look up, and inventing one would
invite code to try.

It should be rare. An actor is `system` only when no user, agent, automation, or
connector caused the change. If a system kind starts appearing often, something
that acts has not been modelled.

## Reference and label are separate types

`Actor` is the reference: exact, stable, small, and what code compares. It goes
on everything that needs attribution, including the many thousands of change
sets a document accumulates.

`ActorLabel` is the display form. It is resolved for rendering, and stored only
where it must survive its subject being deleted — which in practice is
[activity](../collaboration/activity.md#labels-are-denormalized) and nowhere
else.

Keeping them apart is what makes it affordable to attribute *everything*. A
label on every change set would be a display string duplicated thousands of
times per document, going stale the moment someone is renamed.

### Resolving a label

| kind | `name` | `onBehalfOf` | `detail` |
| --- | --- | --- | --- |
| `user` | the user's `displayName` | — | — |
| `agent` | the task's persona `name`, or `"Agent"` | the dispatching user's `displayName` | the task's `title` |
| `automation` | the automation's `name` | — | — |
| `connector` | the connector's `displayName` | — | — |
| `system` | `"System"` | — | — |

The agent row is why three fields exist. Rendered in order it reads
*Researcher · Gabriel Curtis · Q3 competitive scan* — persona, then who asked,
then the job. Each answers a question the others do not: several tasks run the
same persona, a title without its persona does not say what kind of thing
produced the work, and neither says who is accountable for it having happened at
all.

The task title goes last because it is the longest and the most variable, so a
truncated label still carries the identifying parts.

**A generous label is not a loose reference.** `onBehalfOf` names the
dispatching user for display, and changes nothing about attribution — the actor
is still the task, and the dispatcher's undo stack is still untouched. The label
can afford to be informative precisely because it is never what code compares.

## Undo scopes on the actor

[Undo](../revisions/README.md#per-tab-means-per-user) reverts change sets where
`actor.kind === "user"` and `actor.userId` is the person undoing. This is a
designed property of the field, not a filter bolted on later.

The two cases it deliberately excludes:

**Other people's edits.** In a shared document, "undo the most recent change" is
wrong — it reverts a colleague's paragraph because they typed after you.

**Agent and automation edits.** Excluded by the kind check, per
[above](#the-user-behind-an-agent-is-not-the-actor).

## Mentions are the mirror image

A [comment](../collaboration/comment.md) or a [message](message.md) can mention a
user, a persona, or a running task. `Mention` is deliberately not `Actor`, and
the asymmetry is the interesting part:

**You mention a persona; the actor is a task.** A persona is a durable,
addressable identity — mentioning one starts or continues a [persona
thread](../ai/persona-chat.md) with it. A task is a single run, and it is what
actually acts. So the addressable set and the acting set overlap without
matching.

**You can also mention a specific task**, which delivers the message into that
task's own thread — the way to say something to work already in progress rather
than to the persona in general.

`automation`, `connector`, and `system` have no mention case. Nothing is served
by addressing them; they are things that happen, not things you talk to.

## Where actor is not used

Almost nowhere. Anything that can act gets an `Actor`, including the objects
that shape how agents behave — a [persona](../ai/persona.md), an
[automation](../ai/automation.md), a [connector](../special-resources/connector.md),
and a [template](../special-resources/template.md) are all ordinary project
content that an agent may legitimately create.

Configuration in Icarus means [the YAML files](../../../app/configuration/), not
these objects — deployment variables standing in for a `.env`. Those have no
author field because they are not documents.

The remaining `Id<"users">` fields express **human responsibility**, not
authorship:

- [Membership](project.md#membership-is-a-table-and-the-token-is-why) `userId` —
  accountability for a project is not delegable to a process, and a token
  belongs to a person
- [Comment thread](../collaboration/comment.md) `resolvedBy` — anything can
  raise a remark; closing one is a judgement

## Related

[user](user.md) · [change set](../revisions/change-set.md) ·
[activity](../collaboration/activity.md) · [agent task](../ai/agent-task.md)
