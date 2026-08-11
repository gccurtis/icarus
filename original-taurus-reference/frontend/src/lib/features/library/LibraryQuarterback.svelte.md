# `LibraryQuarterback.svelte` — the library's composer

The AI bar at the foot of the library work surface. Deliberately the same shape and behaviour as
the workspace's `QuarterbackDock`: bottom-anchored, dimmed until engaged, expanding upward as
input grows, so the AI entry point looks and feels identical wherever you are in the app.

```svelte
<div class="pointer-events-none absolute bottom-4 left-1/2 z-20 … max-w-3xl">
  <QuarterbackBar bind:value mode={$assistant.mode} placeholders={placeholdersFor(space)} … />
```

It reuses the `QuarterbackBar` primitive rather than reimplementing it, and passes its **full
control set**: mode, **persona**, **web**, send — plus the new `placeholders` override, because
the primitive's defaults name the open document. Each space's four surrounding components carry
`pb-24` so the bar never covers their last row.

**The persona picker and Web toggle render only when fed** (`personas.length`, `onwebchange`).
An earlier pass passed neither, so the library quietly had a lesser bar than the rest of the app
while a personality `<Select>` sat in the panel doing the same job. There is one bar in this
product; a library that needs different data passes different data, not a different bar.

## Why a sibling of the dock, not the dock itself

`QuarterbackDock` is project-scoped through and through: it reads `$workspace` for the active
resource, loads personas per project, and posts through `submitAiPrompt` to project-scoped chat
routes. None of that exists in a library standing outside any project. Sharing the *primitive*
is right; sharing the *dock* would mean faking a project.

Sending opens the panel's second lens — composer and panel are one surface, so either side
activates the other, exactly as the dock does with the inspector. State lives in
[`library-assistant.ts`](library-assistant.ts.md).

## Two destinations, and the bar says which

On Agents a send either **continues the selected task's exchange** or **starts a new agent**, and
the composer's text is identical in both cases. So the bar names its destination in the one place
you are already looking:

```svelte
{#snippet leading()}
  <span data-ai-agent-mark …>AI</span>
  <CornerDownRight /> {target ? 'This task' : 'New agent'}
{/snippet}
```

Two words, not the agent's name: the persona picker two controls along already names the agent, and
the destination and the persona are different facts — *to this task, as Analyst.* One control each,
which is the same rule that got the picker into the bar in the first place. The `title` carries the
full sentence for anyone who hovers.

This uses the primitive's own `leading` slot and keeps the `AI` mark alongside rather than replacing
it — the slot exists so a surface can add its own leading content, not so it can drop the mark. The
placeholder says the same thing, but a placeholder vanishes the moment you type, and the
[AI surface spec](../../../../docs/style/ai-quarterback-surface.md) requires that before a material
action the user knows **where the result goes**. It renders on Agents only: elsewhere the
destination is the asset named in the header a few inches above.

## `onstarted`

Starting an agent is not starting a conversation — so `submitLibraryPrompt` returns the new task's
id and the bar hands it to `onstarted`, letting the console select it. It returns **null when the
turn addressed an existing task**, because nothing was started and the task is already selected,
and null everywhere else, because those turns start nothing. The callback lives here rather than in
the store so the store stays a state container and the console keeps its own selection.
