# Actor

Who did something. One type, used everywhere a change, a creation, or an event
needs attribution.

```ts
type Actor =
  | { kind: "user";    id: string }
  | { kind: "task";    id: string }
  | { kind: "persona"; id: string }
  | { kind: "system" };              // no id: nothing to look up

interface ActorLabel {
  kind: Actor["kind"];
  name: string;                // who acted
  onBehalfOf?: string;         // who asked for it — tasks only
  detail?: string;             // what they were doing — tasks only
}

type Mention =
  | { kind: "user";    id: string }
  | { kind: "persona"; id: string }
  | { kind: "task";    id: string };
```

## One type, not one per consumer

A [change set](../revisions/change-set.md), an
[activity](../collaboration/activity.md) entry, an [agent
task's](../ai/agent-task.md) origin, and a document's `createdBy` are all asking
the same question. Before this they each answered it with their own union,
differing by a case or two — which is how "who edited this" and "who is shown in
the feed" quietly become different answers to the same question.

The four kinds are the complete set of things that can act. Anything new that
acts is a new kind here, added once.

**Every variant is `{ kind, id }`.** Per-variant names — `userId`, `taskId` —
made one shape read four ways for no gain, and it matches
[`ResourceRef`](../special-resources/resource-set.md), so one accessor works on
both.

**`automation` and `connector` are not kinds.** Their tables do not exist yet,
and a variant holding an unvalidated id that nothing can resolve is worse than an
honest absence. They come back with their tables, if they need to at all.

## A task acts when work is tracked; a persona acts when it is talking

A [task](../ai/agent-task.md) actor points at the run, not at the persona behind
it, and not at both. A task already carries its `personaId`, so persona is one
hop away, and storing both would allow them to disagree — a task whose persona
was reassigned would have two answers about who ran it.

The task is also the more specific truth. "The Researcher persona" did not edit
this paragraph; a particular run of it did, and that run has a goal, a message
log, and a plan explaining why.

**But a persona answering in its own chat is not a task.** There is no run, no
goal and no plan — there is a persona saying something in a thread that exists to
hold exactly that. Forcing a task into existence to attribute the reply would
invent a unit of work nobody asked for, so `persona` is its own kind and is used
where there is no run to name.

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

It should be rare. An actor is `system` only when no user, task, or persona
caused the change. If a system kind starts appearing often, something that acts
has not been modelled.

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
| `task` | the task's persona `name`, or `"Agent"` | the dispatching user's `displayName` | the task's `title` |
| `persona` | the persona's `name` | — | — |
| `system` | `"System"` | — | — |

The task row is why three fields exist. Rendered in order it reads
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
`actor.kind === "user"` and `actor.id` is the person undoing. This is a designed
property of the field, not a filter bolted on later.

The two cases it deliberately excludes:

**Other people's edits.** In a shared document, "undo the most recent change" is
wrong — it reverts a colleague's paragraph because they typed after you.

**Anything an agent did**, whether the actor is a `task` or a `persona`.
Excluded by the kind check, per
[above](#the-user-behind-an-agent-is-not-the-actor).

## Mentions are the mirror image

A [comment](../collaboration/comment.md) or a [message](message.md) can mention a
user, a persona, or a running task. `Mention` is `Actor` minus one kind, and that
one exclusion is the whole of the difference:

**`system` has no mention case.** Nothing is served by addressing it; it is a
thing that happens, not a thing you talk to.

The three that remain are addressable because each does something different when
addressed. **Mentioning a persona** starts or continues a [persona
thread](../ai/persona-chat.md) with a durable identity. **Mentioning a task**
delivers into that task's own thread — the way to steer work already in progress
rather than to address the persona in general. **Mentioning a user** notifies a
person.

**A mention is not a field beside the content — it is a
[mark](../content/content-block.md) inside it.** A mention is a span of text
someone typed, so it belongs in the text, which is what makes it shift when
earlier text is edited, survive a merge, and render where it was written. An
extracted `mentions[]` array alongside the blocks could disagree with the
sentences it summarized, and did not know where in a sentence the mention was.

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
