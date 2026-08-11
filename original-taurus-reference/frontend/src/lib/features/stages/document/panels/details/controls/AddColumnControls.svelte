<script lang="ts">
  import { PanelLeftOpen, PanelRightOpen } from '@lucide/svelte';
  import { editorSession } from '../../../editor/session';

  // Insert an empty sibling block beside this one, making (or extending) a row.
  let { blockId }: { blockId: string | null } = $props();

  function insertColumn(side: 'left' | 'right') {
    if (blockId) $editorSession?.actions.addColumn(blockId, side);
  }
</script>

<div class="flex items-center justify-between gap-3 border-t border-border pt-3">
  <span class="flex items-center gap-2 text-caption text-secondary"> Add column </span>
  <div class="flex items-center gap-1">
    <button
      onclick={() => insertColumn('left')}
      aria-label="Add column left"
      title="Add column left"
      class="flex size-7 items-center justify-center rounded-control text-muted hover:bg-elevated hover:text-primary"
    >
      <PanelLeftOpen class="size-4" />
    </button>
    <button
      onclick={() => insertColumn('right')}
      aria-label="Add column right"
      title="Add column right"
      class="flex size-7 items-center justify-center rounded-control text-muted hover:bg-elevated hover:text-primary"
    >
      <PanelRightOpen class="size-4" />
    </button>
  </div>
</div>
