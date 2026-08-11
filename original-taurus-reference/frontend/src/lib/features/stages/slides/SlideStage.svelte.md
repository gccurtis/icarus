# src/lib/features/stages/slides/SlideStage.svelte — breakdown

Companion to [SlideStage.svelte](SlideStage.svelte). The slide-editor stage: the
top bar, the framed work area that hosts the `FabricCanvas`, and the wiring that
publishes this stage's context/inspector panels into the shared surface store.
It mirrors `DocumentStage`'s structure so the two editors feel like one product.

## Imports

### Svelte, icons, collaboration/time data, the slides store, surface types, and child panels

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { Layout, SlidersHorizontal, Type, Shapes, Move, StickyNote } from '@lucide/svelte';
  import { documentBarCollaboration, startPresencePolling, stopPresencePolling, currentDocumentId } from '$systems/documents/collaboration';
  import { documentEditRelative } from '$data/time';
  import { deck, loadDeck, activeSlideIndex, activeObjectId } from '$systems/slides';
  import { activeSurface, type PanelSection } from '$lib/features/shared/surface';
  import FabricCanvas from './FabricCanvas.svelte';
  import SlideListPanel from './SlideListPanel.svelte';
  import SlideActionsPanel from './SlideActionsPanel.svelte';
  import TextPropertiesPanel from './TextPropertiesPanel.svelte';
  import ShapePropertiesPanel from './ShapePropertiesPanel.svelte';
  import ObjectPositionPanel from './ObjectPositionPanel.svelte';
  import NotesPanel from './NotesPanel.svelte';
  import DocumentCollaboratorAvatar from '$lib/features/stages/document/DocumentCollaboratorAvatar.svelte';

```

Imports the mount hook, the Lucide icons used for each inspector tab, the shared
presence/collaboration helpers (reused from the document editor), the relative
edit-time formatter, the slides store (deck + selection stores and `loadDeck`),
the surface store and its `PanelSection` type, the canvas itself, all the panel
components this stage exposes, and the collaborator avatar (shared with the
document stage).

## Props and local state

### Route props, a ticking clock, and derived surface identifiers

```svelte
  let { projectId, title, resourceId }: { projectId: string; title: string; resourceId?: string } = $props();

  let now = $state(Date.now());
  let clock: ReturnType<typeof setInterval> | null = null;

  const surfaceId = $derived(`slides:${resourceId ?? title}`);
  const scope = $derived(`Deck — ${title}`);

```

Receives the project id, deck title, and optional resource id from the work
surface. `now` is a clock value refreshed periodically so the "Edited …" label
stays current; `clock` holds its interval. `surfaceId` uniquely identifies this
stage's panel surface, and `scope` is the human label shown for it.

## Mount and teardown

### Start presence polling, load the mock deck, tick the clock, and clean up

```svelte
  onMount(() => {
    startPresencePolling(projectId);
    currentDocumentId.set(resourceId ?? title);
    loadDeck(title);
    clock = setInterval(() => (now = Date.now()), 30000);

    return () => {
      stopPresencePolling();
      currentDocumentId.set('');
      if (clock) clearInterval(clock);
      activeSurface.set(null);
    };
  });

```

On mount, begins presence polling for the project, tells the collaboration store
which document is in focus, loads the (currently mocked) deck, and starts a
30-second clock. The returned cleanup stops polling, clears the focused document,
cancels the clock, and tears down this stage's surface so stale panels do not
linger after a tab switch.

## Derived active slide and selection

### The current slide and the selected object behind it

```svelte
  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    const objId = $activeObjectId;
    if (!objId || !activeSlide) return null;
    return activeSlide.objects.find((o) => o.id === objId) ?? null;
  });

```

`activeSlide` resolves the slide at the current index (or null). `selectedObject`
looks up the currently selected object within that slide, returning null when
nothing is selected — this is what decides which inspector tabs appear.

## Publishing the panel surface

### Build context + inspector sections from the selection and register them

```svelte
  $effect(() => {
    const obj = selectedObject;
    const inspector: PanelSection[] = [
      { id: 'general', label: 'General', icon: SlidersHorizontal, content: SlideActionsPanel }
    ];
    if (obj) {
      if (obj.kind === 'text') {
        inspector.push({ id: 'text', label: 'Text', icon: Type, content: TextPropertiesPanel });
      } else if (obj.kind === 'shape') {
        inspector.push({ id: 'shape', label: 'Shape', icon: Shapes, content: ShapePropertiesPanel });
      }
      inspector.push({ id: 'position', label: 'Position', icon: Move, content: ObjectPositionPanel });
    }
    if (activeSlide) {
      inspector.push({ id: 'notes', label: 'Notes', icon: StickyNote, content: NotesPanel });
    }
    activeSurface.set({
      id: surfaceId,
      scope,
      context: [
        { id: 'slides', label: 'Slides', icon: Layout, content: SlideListPanel },
        { id: 'templates', label: 'Templates', icon: SquareStack, content: TemplatesPanel }
      ],
      inspector
    });
  });

```

Reactively assembles the panel surface. The inspector always starts with a
General (slide actions) tab; when an object is selected it adds a kind-specific
Text or Shape tab plus a Position tab; when a slide exists it adds a Notes tab.
The context rail offers the slide list and (since 2026-07-28) the mocked
**Templates** panel — the stage-owned `TemplatesPanel.svelte` wrapper pinning
`scope="slides"` onto the shared template panel, which is what enables the
This slide / Whole deck choice in its Make-a-template section. The whole surface
is pushed into `activeSurface`, which the shell renders in its side rails — so
the panels track the selection automatically.

## Edit metadata

### Relative "edited" label and a static save label

```svelte
  const editedRelative = $derived(documentEditRelative(Date.now(), now));
  const saveLabel = $derived('Saved');
</script>

```

`editedRelative` formats how long ago the deck was edited (recomputed as the
clock ticks). `saveLabel` is a placeholder "Saved" — the mock editor has no real
persistence yet.

## Top bar

### Deck name, edit/save status, and open-collaborator avatars

```svelte
{#if $deck}
  <div class="flex h-full flex-col bg-canvas">
    <!-- Top bar — same pattern as DocumentStage -->
    <div class="flex shrink-0 items-center gap-3 border-b border-border bg-work px-4 py-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-body-sm font-medium text-primary" title={$deck.name}>
          {$deck.name}
        </p>
      </div>
      <div class="flex items-center gap-1.5 whitespace-nowrap text-caption text-muted">
        <p>
          Edited
          <time>{editedRelative}</time>
        </p>
        <span aria-hidden="true">·</span>
        <p class="text-caption text-muted" aria-live="polite">{saveLabel}</p>
      </div>
      <div class="flex -space-x-1.5" aria-label="People with this document open">
        {#each $documentBarCollaboration.openUsers as user (user.id)}
          <DocumentCollaboratorAvatar collaborator={user} />
        {/each}
      </div>
    </div>

```

Renders only once a deck is loaded. The outer column fills the height on the
darker `bg-canvas`. The bar (a lighter `bg-work` strip, same pattern as the
document editor) carries the truncated deck name, the "Edited … · Saved" status,
and the stack of avatars for everyone currently viewing the deck.

## Work area

### The gutter surround with the floating slide canvas (or an empty state)

```svelte
    <!-- Body: the darker "canvas" surround is the gutter; the slide floats on it
         as a shadowed panel (mirrors DocumentStage's paper-on-canvas metaphor). -->
    <div class="min-h-0 flex-1 bg-canvas">
      {#if activeSlide}
        <FabricCanvas slide={activeSlide} deck={$deck} class="h-full" />
      {:else}
        <div class="flex h-full items-center justify-center">
          <p class="text-body text-muted">Select or create a slide to begin.</p>
        </div>
      {/if}
    </div>
  </div>
{/if}
```

The body is the darker `bg-canvas` surround that reads as a gutter around the
slide — the counterpart to `DocumentStage`'s paper-on-canvas metaphor, where the
slide floats as a shadowed panel (styled inside `FabricCanvas`). When a slide is
active it hosts the `FabricCanvas`, filling the height; otherwise it shows a
centered empty-state prompt.
