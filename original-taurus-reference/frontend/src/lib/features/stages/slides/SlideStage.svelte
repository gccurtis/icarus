<script lang="ts">
  import { onMount } from 'svelte';
  import { Layout, SlidersHorizontal, SquareStack, Type, Shapes, Move, StickyNote } from '@lucide/svelte';
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
  import TemplatesPanel from './TemplatesPanel.svelte';
  import DocumentCollaboratorAvatar from '$lib/features/stages/document/DocumentCollaboratorAvatar.svelte';

  let { projectId, title, resourceId }: { projectId: string; title: string; resourceId?: string } = $props();

  let now = $state(Date.now());
  let clock: ReturnType<typeof setInterval> | null = null;

  const surfaceId = $derived(`slides:${resourceId ?? title}`);
  const scope = $derived(`Deck — ${title}`);

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

  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    const objId = $activeObjectId;
    if (!objId || !activeSlide) return null;
    return activeSlide.objects.find((o) => o.id === objId) ?? null;
  });

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

  const editedRelative = $derived(documentEditRelative(Date.now(), now));
  const saveLabel = $derived('Saved');
</script>

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
