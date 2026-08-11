<script lang="ts">
  import { inspectorColorPalette } from '$lib/features/shared/inspector-options';
  import { cn } from '$lib/utils';

  // The palette popover shared by the FG and BG swatches. It reports a chosen value
  // and a request for the native picker; TypographyControls owns both.
  let {
    target,
    current,
    onpick,
    oncustom
  }: {
    target: 'fg' | 'bg';
    current: string;
    onpick: (value: string) => void;
    oncustom: () => void;
  } = $props();
</script>

<div
  class="absolute right-0 top-8 z-30 w-36 rounded-panel border border-border bg-work p-2 shadow-panel"
>
  <div class="grid grid-cols-6 gap-1">
    {#each inspectorColorPalette as color (color)}
      <button
        onclick={() => onpick(color)}
        aria-label={`${target === 'fg' ? 'FG' : 'BG'} ${color}`}
        aria-pressed={current === color}
        class={cn(
          'size-4 rounded-sm border',
          current === color ? 'border-action ring-1 ring-action' : 'border-border-strong'
        )}
        style={`background-color: ${color}`}
      ></button>
    {/each}
  </div>
  <button
    onclick={oncustom}
    class="mt-2 w-full rounded-control px-1.5 py-1 text-left text-caption text-secondary hover:bg-elevated"
  >
    Custom color…
  </button>
  {#if target === 'bg'}
    <button
      onclick={() => onpick('')}
      class="mt-1 w-full rounded-control px-1.5 py-1 text-left text-caption text-muted hover:bg-elevated"
    >
      Clear BG
    </button>
  {/if}
</div>
