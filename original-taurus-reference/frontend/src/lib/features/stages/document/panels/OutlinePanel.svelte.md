# src/lib/features/stages/document/panels/OutlinePanel.svelte — breakdown

Companion to [OutlinePanel.svelte](OutlinePanel.svelte). The document surface's
**Outline** context section — the live headings, labeled and indented by level; clicking
one puts the caret there (`actions.focusHeading`) and scrolls it into view. Contributed
to the left rail by `DocumentStage`.

## Script

### Subscribe to the shared editor session store

```svelte
<script lang="ts">
  import { editorSession } from '../editor/session';
</script>

```

The panel's only dependency is the `editorSession` store from the sibling editor. Reading
it reactively (`$editorSession`) means the outline re-renders whenever the document's
headings change, with no local state of its own.

## Empty state

### Show a hint when there is no session or no headings yet

```svelte
<!-- The document's headings, live; click puts the caret there (focusHeading). -->
{#if !$editorSession || $editorSession.outline.length === 0}
  <p class="text-body-sm text-muted">No headings yet — add one and it shows up here.</p>
{:else}
```

Before the session loads, or while the document has no headings, the panel shows a muted
one-line hint instead of an empty container. The `{:else}` hands off to the populated list
below once at least one heading exists.

## The populated headings list

### Render each heading as a level-labeled, indented focus button

```svelte
  <ul class="space-y-0.5">
    {#each $editorSession.outline as h (h.blockId)}
      <li>
        <button
          onclick={() => $editorSession?.actions.focusHeading(h.blockId)}
          class="group dur-micro flex w-full items-center gap-1.5 rounded-control py-1 pr-2 text-left transition-colors hover:bg-elevated"
        >
          <span class="w-5 shrink-0 font-mono text-caption tabular-nums text-muted">
            H{h.level}
          </span>
          <span
            class="truncate text-body-sm text-secondary group-hover:text-primary"
            style={`margin-left: ${(h.level - 1) * 0.5}rem`}
          >
            {h.text || 'Untitled heading'}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
```

Each heading in `outline` (keyed by its stable `blockId`) becomes a full-width button that
calls `focusHeading` to move the caret there. A fixed-width `H{level}` marker makes the
level recognizable without inferring it from indentation alone, while the text still steps
inward by `(level - 1) * 0.5rem`. Missing text falls back to "Untitled heading", and long
titles truncate rather than wrap.
