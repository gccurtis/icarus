# `LibraryPanel.svelte` — the right-hand panel frame and its one switch

The `<aside>`, its scroll, and the section switch every library space shares:
**what you are looking at**, or **the assistant working on it**.

```svelte
<div role="tablist">…{detailsLabel}…{agentLabel}…</div>
<div class="quiet-scroll min-h-0 flex-1 overflow-y-auto">
  {#if $assistant.open}<AgentLens {space} {assetLabel} {task} />{:else}{@render details()}{/if}
```

This mirrors the workspace inspector, whose sections include the AI panel — and the same rule
applies: composer and panel are one surface, so sending from the bar flips this switch. Nothing
else in the app should have to know that.

## The details half arrives as a snippet

Each console passes its own content: `LibraryDetails` for a context, template, or personality;
`TaskDetails` for a selected task; the Agents console's inline "Now" summary on the Activity
view. That is why `LibraryDetails` and `TaskDetails` are plain content components with no
`<aside>` of their own — the frame belongs here, once, so the three spaces cannot drift in
scroll behaviour, width, or material.

`detailsLabel` exists because the left tab should name what it shows: **Task** over a selected
task, **Now** over the Activity summary, **Details** over an asset. A fixed "Details" would be
wrong two times out of three.

## The right lens is one lens, with two labels

Both tabs render [`AgentLens`](AgentLens.svelte.md) on all three spaces. An earlier pass let each
space bring its own second lens, which produced two different answers to the same question — a chat
panel on Context and Templates, a start-an-agent panel on Agents. They are the same act: describe
work, say where it runs and what it reads, send. One lens.

But on Agents that one lens has **two destinations**, so `agentLabel` names which is live:
**Agent** continues the selected task's exchange, **New agent** starts one. Both tabs now name what
you would get rather than which component you would see, and that is the point — the composer looks
identical either way, so the label is doing real work. (Context and Templates keep the default,
`Agent`.)

The label is also why it is not "New": beside `Now` on the Activity view, a tab reading `New` is a
one-letter apart from the tab next to it. `New agent` fits and cannot be misread.

`assetLabel` names the thing on screen so the lens can show it as always-in-scope context; `task`
is the selected task, drilled through rather than duplicated into the assistant store, because the
console owns selection and two owners of one fact is how they fall out of step.
