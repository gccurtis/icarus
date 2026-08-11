<script lang="ts">
  import { IndentDecrease, IndentIncrease } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import { editorSession } from '../../../editor/session';

  // General block indent (0–16), applied to every block the lens names.
  let { blockIds, divided = false }: { blockIds: string[]; divided?: boolean } = $props();

  // Server truth + optimistic pending, read from the first target.
  const currentIndent = $derived($editorSession?.blockAligns[blockIds[0] ?? '']?.indent ?? 0);

  function setIndent(delta: number) {
    const next = Math.max(0, Math.min(16, currentIndent + delta));
    if (blockIds.length) $editorSession?.actions.setBlockIndent(blockIds, next);
  }
</script>

<div class={cn('flex items-center justify-between gap-3', divided && 'border-t border-border pt-3')}>
  <span class="text-caption text-secondary">Indent</span>
  <div class="flex items-center gap-1">
    <button
      onclick={() => setIndent(-1)}
      aria-label="Decrease indent"
      disabled={currentIndent <= 0}
      class="flex size-7 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-30"
    >
      <IndentDecrease class="size-4" />
    </button>
    <span class="w-5 text-center text-caption text-secondary">{currentIndent}</span>
    <button
      onclick={() => setIndent(1)}
      aria-label="Increase indent"
      disabled={currentIndent >= 16}
      class="flex size-7 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-30"
    >
      <IndentIncrease class="size-4" />
    </button>
  </div>
</div>
