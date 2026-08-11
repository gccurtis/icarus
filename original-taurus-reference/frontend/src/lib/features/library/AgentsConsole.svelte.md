# `AgentsConsole.svelte` — monitor, steer, and build personalities

The console behind `/library/agents` and `/library/agents/[id]`: watch the agents working for you
across projects, steer the ones still running, and author the **personalities** they run as.
"Personality" is the product word; the code and backend say persona (`$systems/personas`), and the
two are the same thing.

## Personalities are routes; tasks are selection

A personality is a durable, shareable asset — a link to one must work — so selecting one navigates
to `/library/agents/[id]` and the console receives `personaId` from the route. A task is transient
work: selecting one swaps the detail panel, and deep-linking it earns nothing. An unknown
`personaId` (stale link, deleted personality) falls back to the Activity view rather than erroring.

## The selected task is the hinge of the whole screen

It decides three things at once: what the panel shows, what the second tab is called, and — because
composer and panel are one surface — **where the bar sends**.

| Selection | Panel tabs | The bar |
| --- | --- | --- |
| A task | `Task` · `Agent` | continues that task's exchange |
| A personality | `Details` · `New agent` | starts an agent, as that personality |
| Nothing (Activity) | `Now` · `New agent` | starts an agent, as the default personality |

That is the answer to "how much do we even need a separate Agent lens": one lens, two destinations,
and the label names which. Starting an agent needs no button — it *is* the bar — and talking to one
that already exists needs no second composer.

```svelte
function selectTask(id) { selectedTaskId = selectedTaskId === id ? null : id; closeAssistant(); }
```

**Clicking a task always shows the task**, even with the Agent lens open: clicking a row means "show
me this one", and leaving the composer's lens up would answer a different question. Clicking it
again releases it. So the two directions both work — reach for the bar and you get the agent, click
a task and you get the task.

The selection is also **released when you engage something that is not a task**: navigating (the
`personaId` effect) and focusing a personality's definition (`ondefinitionfocus`). One selection per
work surface, so the bar is never quietly aimed at an agent you have stopped looking at.

```svelte
$effect(() => { const id = selectedTask?.personalityId ?? personality?.id; if (id) setDraftPersonality(id); });
```

**The bar's persona picker always names whoever the bar is addressing** — the agent running the
selected task, or the personality you have open. Open Planner, reach for the bar, and you meant
Planner; defaulting to the roster's default there would be a small lie about what you had just
selected. On Activity, where none is open, the default applies.

Sending returns the new task's id and `started()` selects it: the agent appears at the top of
Working now **and** the panel flips to its Task lens. A flow whose result you cannot see is not a
flow. Sending *to* a task returns null and changes no selection — the line simply appears in the
exchange you were already reading.

The `+` affordance lives on the rail's **Personalities** heading, not on the space: personalities
are what you *make* here.

## The detail panel follows what you are looking at

```svelte
<LibraryPanel space="agents" detailsLabel={selectedTask ? 'Task' : personality ? 'Details' : 'Now'}
  agentLabel={selectedTask ? 'Agent' : 'New agent'} task={selectedTask} …>
```

A selected task always wins — its exchange lives there. A personality shows the shared
`LibraryDetails` (same identity/sharing/about grammar as contexts and templates, with a
personality-appropriate description hint and copy note). Plain Activity shows the three numbers that
answer "do I need to look?". An `$effect` drops the task selection when `personaId` changes — the
panel must never describe a task the center no longer shows — and resets the assistant, since the
conversation was about the old view.

## One composer per screen

`TaskDetails` lost its Send button when the AI bar landed. Two composers for one act, on one
screen, is worse than either alone — so the panel reads the exchange and the bar is where you type,
whether you are steering a running task or starting a new agent.

The bar's `assetName` stays the constant `"a new agent"`, because it only ever feeds the mocked
*reply* copy on Context and Templates; on Agents the destination comes from `task`, and the bar
names it in its own leading slot.

## What is real underneath

Personas, versions, and per-persona task history all exist in Omega (`/personas`,
`personas.revise`, `GET /personas/:id/tasks`) — **project-scoped**. What does not exist: owner
scope, a cross-project task list, and messaging a running task. All fixtures come from
[`agents-mock.ts`](agents-mock.ts.md), the shell carries the Mock badge, and unbuilt actions toast.
