<script lang="ts">
  import { editorSession } from '../editor/session';
</script>

<!-- The document's headings, live; click puts the caret there (focusHeading). -->
{#if !$editorSession || $editorSession.outline.length === 0}
  <p class="text-body-sm text-muted">No headings yet — add one and it shows up here.</p>
{:else}
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
