# `OverviewDetailsPanel.svelte`

Overview's Details lens, contributed to the inspector rail by `OverviewStage`. Like the document
editor's `DetailsPanel`, this file **only dispatches** — every lens owns its own data loading, state,
and copy.

```svelte
{#if selection.mode === 'resource'}
  <ResourceLens resourceId={selection.resourceId} />
{:else if selection.mode === 'resources'}
  <ResourcesLens resourceIds={selection.resourceIds} />
{:else if selection.mode === 'activity'}
  <ActivityLens event={selection.event} redacted={selection.redacted} />
{:else}
  …empty state…
{/if}
```

Keeping this a switch is the point: the document stage's inspector grew to 910 lines before it was
decomposed into lenses, and the rule that came out of that (AGENT-ORIENTATION §4) is **add a lens,
do not grow the dispatcher**. A fourth Overview selection mode means a fourth file here, not another
branch of markup.

The empty state names both entry points ("click a resource row or an activity entry") because the
row-click gesture is new and nothing else on the stage advertises it.
