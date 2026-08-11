# src/lib/features/shell/TabStrip.svelte — breakdown

Companion to [TabStrip.svelte](TabStrip.svelte). The second chrome row. Resource
tabs support **multi-select** (shift-click range, cmd/ctrl-click toggle), closing the
selection with Delete/Backspace, dragging the group to reorder, and a right-click
menu. Permanent destinations blend into the top bar.

## Script — imports and state

### Stores, refs, and selection

```svelte
<script lang="ts">
  import { Plus, X } from '@lucide/svelte';
  import { cn } from '$lib/utils';
  import {
    workspace,
    activateTab,
    closeTab,
    closeOthers,
    closeRight,
    moveTab,
    moveTabs,
    openTab,
    type Tab
  } from '$data/workspace';

  let stripEl = $state<HTMLDivElement>();
  let menu = $state<{ x: number; y: number; tabId: string } | null>(null);
  let draggingId = $state<string | null>(null);
  let overId = $state<string | null>(null);

  // Multi-select over resource tabs: shift-click = range, cmd/ctrl-click = toggle.
  let selected = $state<Set<string>>(new Set());
  let anchorId = $state<string | null>(null);

  const resourceTabs = $derived(($workspace?.tabs ?? []).filter((t) => t.closeable));
```

Adds a `selected` set and an `anchorId` for range selection over the derived
`resourceTabs`.

## Script — scroll, wheel, and selection

### Keep-in-view, wheel, and click handling

```svelte

  // Keep the active resource tab in view as it changes.
  $effect(() => {
    const active = $workspace?.activeTabId;
    if (!active || !stripEl) return;
    stripEl
      .querySelector(`[data-tab="${active}"]`)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });

  function onWheel(e: WheelEvent) {
    if (!stripEl) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      stripEl.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }

  function onTabClick(e: MouseEvent, t: Tab) {
    if (e.shiftKey && anchorId) {
      const a = resourceTabs.findIndex((x) => x.id === anchorId);
      const b = resourceTabs.findIndex((x) => x.id === t.id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        selected = new Set(resourceTabs.slice(lo, hi + 1).map((x) => x.id));
      }
    } else if (e.metaKey || e.ctrlKey) {
      const next = new Set(selected);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      selected = next;
      anchorId = t.id;
    } else {
      selected = new Set();
      anchorId = t.id;
    }
    activateTab(t.id);
  }
```

`onTabClick` implements the selection model: **shift-click** selects the range from
the anchor; **cmd/ctrl-click** toggles one; a plain click clears the selection and
sets a fresh anchor. Every click also activates the tab.

## Script — close, keys, and drag

### Selection close, keyboard, context menu, and drop

```svelte

  function closeSelected() {
    for (const id of selected) closeTab(id);
    selected = new Set();
    anchorId = null;
  }

  function onKeydown(e: KeyboardEvent) {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
    if ((e.key === 'Backspace' || e.key === 'Delete') && selected.size > 0) {
      e.preventDefault();
      closeSelected();
    } else if (e.key === 'Escape' && selected.size > 0) {
      selected = new Set();
    }
  }

  function openMenu(e: MouseEvent, tabId: string) {
    e.preventDefault();
    menu = { x: e.clientX, y: e.clientY, tabId };
  }
  function act(fn: () => void) {
    fn();
    menu = null;
  }

  function onDragStart(t: Tab) {
    draggingId = t.id;
    if (!selected.has(t.id)) selected = new Set();
  }
  function onDrop(id: string) {
    if (draggingId) {
      if (selected.has(draggingId) && selected.size > 1) moveTabs([...selected], id);
      else if (draggingId !== id) moveTab(draggingId, id);
    }
    draggingId = null;
    overId = null;
  }
</script>

<svelte:window onkeydown={onKeydown} />
```

`onKeydown` (window) closes the selection on Delete/Backspace and clears it on
Escape — ignored while typing in a field. `onDragStart` keeps the selection only if
you grab a selected tab; `onDrop` moves the whole group (`moveTabs`) when dragging a
selection, else the single tab.

## Markup — tabs

### Permanent destinations and selectable resource chips

```svelte

{#if $workspace}
  <div class="surface-panel flex h-tabstrip shrink-0 items-stretch gap-2 px-2">
    <!-- Permanent destinations: blend into the top bar surface -->
    <div class="flex items-stretch">
      {#each $workspace.tabs.filter((t) => !t.closeable) as t (t.id)}
        <button
          onclick={() => activateTab(t.id)}
          class={cn(
            'dur-small flex items-center border-b-2 px-3 text-label font-medium transition-colors',
            $workspace.activeTabId === t.id
              ? 'border-action text-primary'
              : 'border-transparent text-muted hover:text-secondary'
          )}
        >
          {t.title}
        </button>
      {/each}
    </div>

    <!-- Recessed strip: resource tabs sit "in front"; multi-select, drag, right-click -->
    <div
      bind:this={stripEl}
      onwheel={onWheel}
      class="tab-scroll my-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-control bg-canvas px-1 shadow-[inset_0_1px_2px_rgb(0_0_0_/_0.06)]"
    >
      {#each resourceTabs as t (t.id)}
        {@const isSel = selected.has(t.id)}
        {@const isActive = $workspace.activeTabId === t.id}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          data-tab={t.id}
          draggable="true"
          ondragstart={() => onDragStart(t)}
          ondragover={(e) => { e.preventDefault(); overId = t.id; }}
          ondrop={() => onDrop(t.id)}
          ondragend={() => { draggingId = null; overId = null; }}
          oncontextmenu={(e) => openMenu(e, t.id)}
          class={cn(
            'group dur-small flex shrink-0 cursor-grab items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-label transition-colors active:cursor-grabbing',
            isActive ? 'bg-work text-primary shadow-panel' : isSel ? 'bg-action/10 text-action' : 'text-muted hover:text-secondary hover:underline hover:underline-offset-4',
            isSel && 'ring-1 ring-inset ring-action/40',
            draggingId === t.id && 'opacity-50',
            overId === t.id && draggingId && draggingId !== t.id && 'ring-1 ring-action'
          )}
        >
          <button onclick={(e) => onTabClick(e, t)} class="max-w-40 truncate">{t.title}</button>
          <button
            onclick={() => closeTab(t.id)}
            aria-label="Close tab"
            class="dur-micro rounded p-0.5 opacity-0 transition-opacity hover:bg-border group-hover:opacity-100"
          >
            <X class="size-3" />
          </button>
        </div>
      {/each}
      <button
        onclick={() => openTab()}
        aria-label="New tab"
        class="dur-small sticky right-0 ml-0.5 shrink-0 rounded-[6px] bg-canvas p-1 text-muted transition-colors hover:bg-panel hover:text-primary"
      >
        <Plus class="size-4" />
      </button>
    </div>
  </div>
```

Permanent destinations render as underline tabs. Each resource chip carries the drag
handlers and `oncontextmenu`; its name button routes through `onTabClick` (selection
model). Selected chips get a `bg-action/10` + inset ring; the active chip is
`bg-work` + shadow; an idle chip stays background-free and just **brightens + underlines
its label on hover** (no background fill). The drop target gets a stronger ring. The
sticky `+` opens a tab.

## Markup — context menu

### Selection-aware options

```svelte

  {#if menu}
    {@const tabId = menu.tabId}
    {@const title = $workspace.tabs.find((t) => t.id === tabId)?.title ?? ''}
    {@const hasSelection = selected.size > 1 && selected.has(tabId)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={() => (menu = null)} oncontextmenu={(e) => { e.preventDefault(); menu = null; }}></div>
    <div
      role="menu"
      class="surface-elevated fixed z-50 min-w-48 p-1 text-body-sm"
      style={`left:${menu.x}px; top:${menu.y}px`}
    >
      {#snippet item(label: string, fn: () => void, danger = false)}
        <button
          role="menuitem"
          onclick={() => act(fn)}
          class={cn(
            'dur-micro block w-full rounded-control px-3 py-1.5 text-left transition-colors hover:bg-panel',
            danger ? 'text-danger' : 'text-secondary hover:text-primary'
          )}
        >
          {label}
        </button>
      {/snippet}
      {@render item('New tab', () => openTab())}
      {@render item('Duplicate tab', () => openTab(title))}
      <div class="my-1 h-px bg-border"></div>
      {#if hasSelection}
        {@render item(`Close ${selected.size} selected`, () => closeSelected(), true)}
      {:else}
        {@render item('Close', () => closeTab(tabId))}
      {/if}
      {@render item('Close others', () => closeOthers(tabId))}
      {@render item('Close to the right', () => closeRight(tabId))}
    </div>
  {/if}
{/if}
```

The right-click menu is cursor-positioned with a dismissing backdrop. When the
right-clicked tab is part of a multi-selection, the close item becomes "Close N
selected"; otherwise it's a single Close. New tab / Duplicate / Close others / Close
to the right round it out.

## Styles

### Hidden scrollbar

```svelte

<style>
  /* Scroll without a visible scrollbar — wheel and click-into-view move the tabs. */
  .tab-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .tab-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
```

The scrollbar is hidden; tabs scroll by wheel and active-into-view.
