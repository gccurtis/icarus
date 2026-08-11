# src/lib/features/stages/slides/NotesPanel.svelte — breakdown

Companion to [NotesPanel.svelte](NotesPanel.svelte). Inspector section for slide-scoped speaker notes. Appears in the inspector rail whenever a slide is active, regardless of object selection.

## Script — imports and derived state

### Read the current slide from the deck store

```svelte
<script lang="ts">
  import { StickyNote } from '@lucide/svelte';
  import { deck, activeSlideIndex, setSlideNotes } from '$systems/slides';

  const currentSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);
</script>

```

Reads the current slide directly from the deck store. Unlike object-specific panels, no `activeObjectId` is involved — notes belong to the slide. `StickyNote` is imported for use by the enclosing inspector chrome. `currentSlide` resolves to null when the deck is absent or the active index is out of bounds.

## Markup — notes textarea

### Resizable textarea bound to the slide's notes

```svelte
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
```

A resizable textarea (`resize-y`, `min-h-[120px]`) styled to match the design system. Writes on each keystroke via `oninput` → `setSlideNotes()`. The `setSlideNotes` store function replaces the slide's `notes` field, emitting a new deck reference. Since notes are slide-scoped (not canvas objects), they don't trigger `FabricCanvas` re-sync.

## Markup — fallback

### Prompt shown when no slide is active

```svelte
{:else}
  <p class="text-caption text-muted">Select a slide to add notes.</p>
{/if}
```

Appears when no slide is available (deck is null or `activeSlideIndex` out of bounds).
