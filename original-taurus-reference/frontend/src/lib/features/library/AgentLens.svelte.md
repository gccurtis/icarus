# `AgentLens.svelte` — the panel's second lens, on every library space

One lens for all three spaces, because a library send is **a whole agent request**, not a chat:
it runs somewhere, as someone, over something. This holds the parts the bar cannot express; the
bar holds mode, persona, web, and the text. It replaced two components — a chat-shaped
`LibraryAssistant` and an Agents-only `NewAgentPanel` — which had drifted into two different
answers to the same question.

## Two shapes, because the bar has two destinations

```svelte
{#if task}  <!-- talking to an agent that exists -->
{:else}     <!-- composing a new one -->
```

**With a task selected** the lens is that task's exchange: you are talking to an agent, not
starting one, and the bar's send continues the conversation you are reading. There is deliberately
**no Project picker and no Add context** in this shape — where the task runs and what it reads were
settled when it was born, and offering to change them would promise something an agent cannot do
(an agent never moves between projects). What it shows instead is identification — state pill,
personality, project, objective — plus the exchange itself.

**With nothing selected** the send starts a new agent, and the lens is the rest of that request:
where it runs, what it reads. Context and Templates only ever have this shape.

The distinction is stated three times over, on purpose, because the composer's text looks identical
either way: the tab reads `Agent` or `New agent`, the bar's placeholder names the agent it will
reach, and the cue under the mode says which act is live. Per the [AI surface
spec](../../../../docs/style/ai-quarterback-surface.md), *where the result goes* is something the
user must know before a material action.

## One control each, never two

The persona picker is **in the bar**, not here: it is the personality the request runs as, and the
shared `QuarterbackBar` already has that control. An earlier pass put a personality `<Select>` in
this panel *and* left the bar's picker unpassed, which is how the library ended up with a bar
missing half its controls. Anything the bar can express belongs to the bar.

## Project, including None

```svelte
<Select id="agent-project" value={$assistant.draft.project} options={projectOptions} />
```

Library work still has to run somewhere, and an agent never moves between projects, so the project
is chosen up front. **`None` is the default** and is not a null case: Omega will back it with a
per-user, unshareable internal project so agent work on library assets always has a home. That is
why it sits first in the list rather than reading as "unset".

## Context: the asset is implicit, everything else is deliberate

```svelte
{#if assetLabel}<Chip tone="intel">{assetLabel}</Chip>{/if}
{#each added as c}<Chip onremove={…}>{c.name}</Chip>{/each}
<Button …>Add context</Button>
```

What you are looking at is **always in scope** and is not a checkbox — making the user tick "this
context" on the context screen is asking them to confirm the obvious. Everything else is added on
purpose through a modal over the whole context library, because a checkbox grid cannot hold it and
a dropdown anchored in a short panel runs off the screen.

This replaced a two-checkbox "sources" grid inherited from the dock, whose second entry ("Your
contexts") was a toggle standing in for a choice nobody had made yet.

(Both of these belong to the new-agent shape only. A selected task has neither.)

## The Agents difference is only what Send does

Composing a new agent, Agents shows the dispatch note instead of a transcript, because there the
result is a task in the monitor rather than a reply here. Everything above it — project, context,
the bar — is identical, which is the point: three spaces, one way to ask for work.

## The exchange is not re-drawn here

The transcript renders through [`TaskExchange`](TaskExchange.svelte.md), the same component the
[Task lens](TaskDetails.svelte.md) uses, at a taller cap (`max-h-72`) because here the conversation
*is* the lens rather than one section of it. Same conversation, same grammar, seen from the
composer's side.

Sending is honest in both shapes: a new agent arrives **queued, not running**, and a line sent to
an existing task is recorded and then says it was not delivered — Omega's task API is
create/get/list/accept-plan, with no way to message a running task.
