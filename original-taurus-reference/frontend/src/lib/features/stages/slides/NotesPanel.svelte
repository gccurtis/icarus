<script lang="ts">
  import { StickyNote } from '@lucide/svelte';
  import { deck, activeSlideIndex, setSlideNotes } from '$systems/slides';

  const currentSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);
</script>

{#if currentSlide}
  <div class="space-y-3">
    <p class="text-caption text-muted">Speaker notes for this slide.</p>
    <textarea
      value={currentSlide.notes ?? ''}
      oninput={(e: Event) => {
        const target = e.currentTarget as HTMLTextAreaElement;
        setSlideNotes(currentSlide.id, target.value);
      }}
      placeholder="Add notes..."
      class="dur-small w-full min-h-[120px] resize-y rounded-control border border-border bg-panel px-3 py-2 text-body-sm text-primary placeholder:text-muted focus:border-action focus:outline-none"
    ></textarea>
  </div>
{:else}
  <p class="text-caption text-muted">Select a slide to add notes.</p>
{/if}
