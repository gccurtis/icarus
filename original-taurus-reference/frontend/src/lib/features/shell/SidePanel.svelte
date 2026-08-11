<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import { ChevronsLeft, ChevronsRight } from '@lucide/svelte';
  import { cn } from '$lib/utils';

  type Section = { id: string; label: string; icon: Component };

  let {
    side,
    sections,
    activeSection,
    width,
    collapsed,
    min,
    max,
    onresize,
    ontoggle,
    onselect,
    content
  }: {
    side: 'left' | 'right';
    sections: Section[];
    activeSection: string;
    width: number;
    collapsed: boolean;
    min: number;
    max: number;
    onresize: (width: number) => void;
    ontoggle: (collapsed: boolean) => void;
    onselect: (id: string) => void;
    content?: Snippet<[string]>;
  } = $props();

  let dragging = $state(false);

  function onDown(e: PointerEvent) {
    e.preventDefault();
    dragging = true;
    const startX = e.clientX;
    const startW = collapsed ? min : width;
    const dir = side === 'left' ? 1 : -1;

    function move(ev: PointerEvent) {
      const w = startW + dir * (ev.clientX - startX);
      if (w < min * 0.6) {
        if (!collapsed) ontoggle(true);
      } else {
        if (collapsed) ontoggle(false);
        onresize(Math.max(min, Math.min(max, w)));
      }
    }
    function up() {
      dragging = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const activeLabel = $derived(sections.find((s) => s.id === activeSection)?.label ?? '');
  const collapseInward = $derived(side === 'left');
</script>

<div class={cn('relative flex h-full shrink-0', side === 'left' ? 'flex-row' : 'flex-row-reverse')}>
  <!-- Icon rail: always visible; each icon selects a section (and expands). -->
  <div
    class={cn(
      'surface-panel flex h-full w-rail shrink-0 flex-col items-center gap-1 py-2',
      side === 'left' ? 'border-r border-border' : 'border-l border-border'
    )}
  >
    {#each sections as s (s.id)}
      {@const Icon = s.icon}
      <button
        onclick={() => {
          if (activeSection === s.id && !collapsed) {
            ontoggle(true);
          } else {
            onselect(s.id);
          }
        }}
        aria-label={s.label}
        aria-pressed={activeSection === s.id && !collapsed}
        title={s.label}
        class={cn(
          'dur-small flex size-8 items-center justify-center rounded-control transition-colors',
          activeSection === s.id
            ? 'bg-action/12 text-action'
            : 'text-muted hover:bg-elevated hover:text-primary'
        )}
      >
        <Icon class="size-4" />
      </button>
    {/each}
    <div class="mt-auto">
      <button
        onclick={() => ontoggle(!collapsed)}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
        class="dur-small flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-elevated hover:text-primary"
      >
        {#if collapsed === collapseInward}
          <ChevronsRight class="size-4" />
        {:else}
          <ChevronsLeft class="size-4" />
        {/if}
      </button>
    </div>
  </div>

  {#if !collapsed}
    <!-- A labelled landmark: the two rails are otherwise indistinguishable to
         anything navigating by structure, and "the inspector" is a thing users
         and tests both need to be able to address. -->
    <aside
      aria-label={side === 'left' ? 'Context panel' : 'Inspector panel'}
      class={cn(
        'surface-panel flex h-full flex-col',
        side === 'left' ? 'border-r border-border' : 'border-l border-border'
      )}
      style={`width:${width}px`}
    >
      <div class="flex h-tabstrip shrink-0 items-center px-3 text-label font-semibold uppercase tracking-wide text-muted">
        {activeLabel}
      </div>
      <div class="panel-scroll min-h-0 flex-1 overflow-auto px-3 pb-3">
        {@render content?.(activeSection)}
      </div>
    </aside>
  {/if}

  <!-- Drag handle at the inner edge (toward the work surface) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onpointerdown={onDown}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize panel"
    class={cn(
      'absolute inset-y-0 z-10 w-1 cursor-col-resize transition-colors',
      side === 'left' ? 'right-0' : 'left-0',
      dragging ? 'bg-focus' : 'hover:bg-focus/50'
    )}
  ></div>
</div>

<style>
  .panel-scroll {
    scrollbar-width: none;
  }

  .panel-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
