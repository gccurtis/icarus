# `TaskExchange.svelte` — the one exchange grammar

A task's transcript, rendered the same way everywhere it appears: you are `action`, the agent is
`intel`, per the [color roles](../../../../docs/style/color-system.md#semantic-roles), and the whole
thing scrolls inside its own bounded frame.

```svelte
<div class="quiet-scroll {max} … rounded-control border border-border bg-work p-2.5">
  <span class="font-medium {line.author === 'you' ? 'text-action' : 'text-intel'}">You|Agent</span>
```

## Why it is a component and not two copies

[`TaskDetails`](TaskDetails.svelte.md) reads the exchange beside the working list; the [Agent
lens](AgentLens.svelte.md) reads it as the conversation the bar continues. It is **one
conversation** — the same lines, about the same task, on the same screen — so it must not acquire
two appearances depending on which tab happens to be open. Extracting it was the alternative to
writing the same twelve lines twice and letting them drift.

`max` is the only thing that varies: the Task lens caps it at `max-h-56` because it is one section
among three, and the Agent lens at `max-h-72` because there the conversation is the whole lens.

## Bounded, always

The cap is not decoration. A long exchange must not push the rest of a panel off the screen, so it
scrolls within its own frame the way every other bounded list in this shell does (`ResourceTable`,
`Shared with N`, `Working now`) — and it scrolls quietly, with no visible scrollbar, per the
[surfaces spec](../../../../docs/style/surfaces-components-motion.md).

There is no composer here. Typing at an agent happens in **one** place per screen — the bar at the
foot of the work surface — so this component only ever reads.
