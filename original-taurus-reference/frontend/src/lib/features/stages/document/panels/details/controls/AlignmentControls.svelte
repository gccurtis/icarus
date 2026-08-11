<script lang="ts">
  import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    AlignVerticalSpaceAround,
    ArrowDownToLine,
    ArrowUpToLine
  } from '@lucide/svelte';
  import type { HorizontalAlignment, VerticalAlignment } from '$data/documents';
  import { cn } from '$lib/utils';
  import { editorSession } from '../../../editor/session';

  // Horizontal + vertical alignment for the block lenses (not the text lenses —
  // alignment is a block property, not an inline mark).
  let { blockIds }: { blockIds: string[] } = $props();

  const horizontalAlignments = [
    { value: 'left', label: 'Align left', icon: AlignLeft },
    { value: 'center', label: 'Align center', icon: AlignCenter },
    { value: 'right', label: 'Align right', icon: AlignRight }
  ];

  const verticalAlignments = [
    { value: 'top', label: 'Align top', icon: ArrowUpToLine },
    { value: 'middle', label: 'Align middle', icon: AlignVerticalSpaceAround },
    { value: 'bottom', label: 'Align bottom', icon: ArrowDownToLine }
  ];

  // Fallbacks match the editor's block defaults until the real style is read below.
  let horizontal = $state<string>('left');
  let vertical = $state<string>('top');
  let alignFor = $state('');

  // Seed the toggles from the inspected block's real style (server truth +
  // optimistic pending), re-reading when the target or its alignment changes.
  $effect(() => {
    const first = blockIds[0];
    const align = first ? $editorSession?.blockAligns[first] : undefined;
    const key = `${blockIds.join(':')}:${align?.horizontalAlign ?? ''}:${align?.verticalAlign ?? ''}`;
    if (key !== alignFor) {
      alignFor = key;
      horizontal = align?.horizontalAlign ?? 'left';
      vertical = align?.verticalAlign ?? 'top';
    }
  });

  function applyHorizontalAlign(value: string) {
    horizontal = value;
    if (blockIds.length)
      $editorSession?.actions.setBlockAlignment(blockIds, {
        horizontalAlign: value as HorizontalAlignment
      });
  }

  function applyVerticalAlign(value: string) {
    vertical = value;
    if (blockIds.length)
      $editorSession?.actions.setBlockAlignment(blockIds, {
        verticalAlign: value as VerticalAlignment
      });
  }
</script>

<div class="flex items-center justify-between gap-1 border-t border-border pt-3">
  <div class="flex items-center gap-1">
    <div class="flex items-center gap-0.5">
      {#each horizontalAlignments as alignment (alignment.value)}
        {@const Icon = alignment.icon}
        <button
          onclick={() => applyHorizontalAlign(alignment.value)}
          aria-label={alignment.label}
          aria-pressed={horizontal === alignment.value}
          title={alignment.label}
          class={cn(
            'flex size-6 items-center justify-center rounded-control',
            horizontal === alignment.value
              ? 'bg-action/12 text-action'
              : 'text-muted hover:bg-elevated hover:text-primary'
          )}
        >
          <Icon class="size-3.5" />
        </button>
      {/each}
    </div>
    <div
      role="separator"
      aria-label="Horizontal and vertical alignment"
      aria-orientation="vertical"
      class="mx-0.5 h-5 w-px bg-border"
    ></div>
    <div class="flex items-center gap-0.5">
      {#each verticalAlignments as alignment (alignment.value)}
        {@const Icon = alignment.icon}
        <button
          onclick={() => applyVerticalAlign(alignment.value)}
          aria-label={alignment.label}
          aria-pressed={vertical === alignment.value}
          title={alignment.label}
          class={cn(
            'flex size-6 items-center justify-center rounded-control',
            vertical === alignment.value
              ? 'bg-action/12 text-action'
              : 'text-muted hover:bg-elevated hover:text-primary'
          )}
        >
          <Icon class="size-3.5" />
        </button>
      {/each}
    </div>
  </div>
</div>
