# src/lib/features/shell/WorkSurface.svelte — breakdown

Companion to [WorkSurface.svelte](WorkSurface.svelte). The center region of the
shell; it renders the **active tab's stage**. New stages plug in here.

## Script

### The active tab and props

```svelte
<script lang="ts">
  import type { Tab } from '$data/workspace';
  import { enterProjectResources, resources } from '$data/resources';
  import OverviewStage from '$lib/features/stages/overview/OverviewStage.svelte';
  import NewTabStage from '$lib/features/stages/new-tab/NewTabStage.svelte';
  import DocumentStage from '$lib/features/stages/document/DocumentStage.svelte';
  import SlideStage from '$lib/features/stages/slides/SlideStage.svelte';

  // Renders the active tab's stage in the work-surface region. New stages plug in
  // here as they're built.
  let {
    tab,
    projectId,
    projectName
  }: { tab: Tab | null; projectId: string; projectName: string } = $props();

  // Load the project's resources here too, so a reload straight onto a resource
  // tab can resolve the tab's kind without visiting Overview first.
  $effect(() => {
    enterProjectResources(projectId);
  });
  // A Resource tab normally carries its canonical family kind; legacy persisted
  // tabs without one fall back to the loaded catalog's name lookup.
  const tabKind = $derived(
    tab?.kind === 'resource' ? tab.resourceKind ?? $resources.find((r) => r.name === tab.title)?.kind : undefined
  );
</script>

```

Takes the active `tab` plus project id/name; imports the stages it can render
(Overview, the New-tab launcher, the Document editor, and the Slide editor). The
`$effect` enters the project's resources so a direct reload onto a resource tab can
still resolve its kind. `tabKind` first trusts the canonical kind stored on a current
resource tab, then falls back to a name lookup in the real catalog for legacy persisted
tabs that predate `resourceKind`.

## Markup

### Stage switch

```svelte
<!--
  overflow-hidden: the stage owns its own scrolling (so the stage frame itself never
  scrolls — e.g. the Overview stage keeps its header/cards fixed and scrolls only the
  table body). Placeholder stages wrap their content in an overflow-auto region.
-->
<main class="min-w-0 flex-1 overflow-hidden bg-work">
  {#if tab?.id === 'overview'}
    <OverviewStage {projectId} {projectName} />
  {:else if tab && tab.kind === 'new'}
    <NewTabStage {tab} {projectId} />
  {:else if tab && tab.kind === 'resource' && tabKind === 'document'}
    <!-- Keyed by tab: each document tab gets its own stage instance, attached to
         its own runtime (switching tabs detaches/re-attaches, never mixes). -->
    {#key tab.id}
      <DocumentStage {projectId} title={tab.title} resourceId={tab.resourceId} />
    {/key}
  {:else if tab && tab.kind === 'resource' && tabKind === 'slides'}
    {#key tab.id}
      <SlideStage {projectId} title={tab.title} resourceId={tab.resourceId} />
    {/key}
  {:else}
    <div class="h-full overflow-auto">
      <div class="mx-auto max-w-3xl px-8 py-12">
        <p class="text-label uppercase tracking-wide text-muted">{tab?.title ?? 'Resource'}</p>
        <h1 class="mt-1 text-h2 font-semibold">{tab?.title ?? 'Untitled'}</h1>
        <p class="mt-4 max-w-prose text-body text-secondary">
          This resource's editor renders here — placeholder for now.
        </p>
      </div>
    </div>
  {/if}
</main>
```

The `main` fills the center (min-width so the side panels can't squeeze it out) on
the `bg-work` surface. It's `overflow-hidden` so **each stage owns its own
scrolling**: Overview and the **New-tab launcher** (`tab.kind === 'new'`, the "+") keep
their header/cards fixed and scroll only their table body; a **document resource tab**
renders the real [DocumentStage](../stages/document/DocumentStage.svelte) editor and a
**slides resource tab** renders the [SlideStage](../stages/slides/SlideStage.svelte)
editor (each keyed by tab id for a fresh runtime-attached instance); the remaining
placeholder stage (non-editor resource tabs) wraps its content in an
`h-full overflow-auto` region. Additional stages are added as new branches here.
The old `agents` tab branch is gone: Agents was promoted to the user-scoped
`/library/agents` route (2026-07-29) — agents span projects, so a tab inside one
project's shell could never honestly show them.
