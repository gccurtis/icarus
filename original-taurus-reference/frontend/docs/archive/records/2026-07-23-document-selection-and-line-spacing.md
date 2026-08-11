# Document gutter cleanup and Line Spacing control

## Removed the left-gutter row/block inspection handles

```svelte
-  import { GripVertical, Sparkles } from '@lucide/svelte';
+  import { Sparkles } from '@lucide/svelte';
```

```svelte
-  // Gutter state: entering the left gutter reveals one handle per document row;
-  // AI/prompt indicators remain on the right. Both stay outside the paper.
-  let gutterActive = $state(false);
-  let rowHandles = $state<{ key: string; top: number; pos: number }[]>([]);
+  // Right gutter: AI/prompt indicators remain on the right, outside the paper.
   let prompts = $state<{ top: number }[]>([]);
```

```svelte
-      <!-- Left gutter: entering reveals one inspection handle per document row -->
-      {#if $info.status === 'ready'}
-        <div role="toolbar" aria-label="Document row gutter" ...>
-          {#if gutterActive}
-            {#each rowHandles as handle, index (handle.key)}
-              <button onpointerdown={(event) => inspectAnchor(handle.pos, event)} ...>
-                <GripVertical class="size-4" />
-              </button>
-            {/each}
-          {/if}
-        </div>
-      {/if}
-
       <!-- Right gutter: symbols for special blocks (AI/prompt) -->
```

The left gutter's hover-revealed grip handles (one per document row, opening Row/Block/Multiple-Blocks inspection on pointer-down) are no longer part of the interaction model — inspecting a block or row now flows entirely from the editor's own selection, so a second, redundant entry point outside the page was removed along with `inspectAnchor`, `gutterActive`, and `rowHandles`. `updateGutter()` now only measures the right-side AI/prompt indicators. The right gutter (Sparkles markers for prompt blocks) is unchanged.

## Removed the "Select full block" icon button from Selected Text / Next Text

```svelte
-{#snippet selectBlockButton(blockId: string | null)}
-  <button
-    onclick={() => blockId && $editorSession?.actions.inspectBlock(blockId)}
-    disabled={!blockId}
-    aria-label="Select full block"
-    title="Select full block"
-    class="dur-micro flex size-7 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-40"
-  >
-    <SquareDashedMousePointer class="size-4" />
-  </button>
-{/snippet}
```

```svelte
-      <div class="flex items-start justify-between gap-3">
-        <div class="min-w-0">
-          <p class="text-caption font-medium text-secondary">Selected Text</p>
-          <p class="mt-1 line-clamp-3 whitespace-pre-wrap text-body-sm text-primary">
-            "{selection.text}"
-          </p>
-        </div>
-        {@render selectBlockButton(selection.blockIds[0] ?? null)}
-      </div>
+      <div class="min-w-0">
+        <p class="text-caption font-medium text-secondary">Selected Text</p>
+        <p class="mt-1 line-clamp-3 whitespace-pre-wrap text-body-sm text-primary">
+          "{selection.text}"
+        </p>
+      </div>
```

This button was the other half of the removed gutter affordance — a way to jump from an inline text selection up to its containing block. With that path gone, the icon button (and its now-unused `SquareDashedMousePointer` import) was removed from both the "Selected Text" (`run` mode) and "Next Text" (`new-text` mode) sections, simplifying each back to a plain label-and-content stack.

## Added a Line Spacing control between Reference and Add Comment

```svelte
  const LINE_SPACING_OPTIONS = [
    { value: '1', label: 'Single' },
    { value: '1.15', label: '1.15' },
    { value: '1.5', label: '1.5' },
    { value: '2', label: 'Double' }
  ];
```

```svelte
      <div class="space-y-2 border-t border-border pt-3">
        <p class="text-caption text-secondary">Line spacing</p>
        <Select
          bind:value={lineSpacing}
          aria-label="Line spacing"
          options={LINE_SPACING_OPTIONS}
          size="sm"
        />
      </div>

      <div class="border-t border-border pt-3">
        <Button ... onclick={() => mockAction('Adding comments')}>
```

Line spacing is a new, currently mock, typography control. It's placed in its own divided row directly below Reference and above Add Comment, so it reads as a distinct setting rather than crowding either neighbor — both the new section and the existing comment row open with `border-t border-border pt-3`, giving the "divider on both sides" look. `LINE_SPACING_OPTIONS` is declared as a plain (non-`const`) array of `{ value, label }` objects because `Select`'s `options` prop expects a mutable `Option[]`; an `as const` tuple is `readonly` and fails `svelte-check`.

## Companion sync

Both `DocumentStage.svelte.md` and `DetailsPanel.svelte.md` were updated to mirror the trimmed/expanded source exactly (verified with a byte-for-byte diff of the fenced code blocks against the live source), per the repository's markdown-companion requirement.
