<script lang="ts">
  import type { Component } from "svelte";

  import type { ContextId } from "$views/context-panel/procedures/resolve-context";
  import { RAIL_WIDTH } from "$views/context-panel/types";

  /**
   * The rail — the fixed strip that chooses what the panel shows.
   *
   * It takes its entries rather than reading the workbench itself, because the
   * panel root already resolves the same key to a content component. One reader
   * of `activeContext`, one place the map lives, and the rail stays a control
   * that reports a choice.
   */
  let {
    contexts,
    available,
    active,
    collapsed,
    onselect
  }: {
    /** Display copy for every context the model can name. */
    contexts: Record<ContextId, { label: string; icon: Component }>;
    /** What this resource kind offers, in the order it offers them. */
    available: readonly ContextId[];
    /** The one currently showing. */
    active: ContextId;
    /**
     * Whether the panel beside this rail is shut. The rail itself never
     * collapses — it is what the panel collapses *to*, and the only way back.
     */
    collapsed: boolean;
    onselect: (id: ContextId) => void;
  } = $props();
</script>

<nav class="rail" aria-label="Contexts" style:width="{RAIL_WIDTH}px">
  {#each available as id (id)}
    {@const entry = contexts[id]}
    {@const Icon = entry.icon}
    <button
      type="button"
      class="entry"
      class:selected={id === active && !collapsed}
      aria-current={id === active && !collapsed ? "true" : undefined}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `${entry.label} — opens the panel` : entry.label}
      title={entry.label}
      onclick={() => onselect(id)}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  {/each}
</nav>

<style>
  .rail {
    /* Width is applied inline from RAIL_WIDTH, the same constant the frame adds
     * to the model's content width to size this whole column. One number. */
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--token-spacing-unit);
    padding-block: var(--token-spacing-unit);
    border-right: 1px solid var(--token-border-subtle);
  }

  .entry {
    /* 32px square: comfortably past the 24px minimum target, and square so the
     * selected marker below has a full edge to sit against. */
    width: calc(var(--token-spacing-unit) * 8);
    height: calc(var(--token-spacing-unit) * 8);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    border: none;
    border-radius: var(--token-radius-control);
    background: none;
    color: var(--token-ink-muted);
    cursor: pointer;
  }

  .entry:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .selected {
    color: var(--token-color-active-text);
    background-color: var(--token-color-active-surface);
  }

  /* Selection is not carried by colour alone: a marker on the inline edge says
   * the same thing to anyone who cannot see the tint. */
  .selected::before {
    content: "";
    position: absolute;
    inset-inline-start: calc(var(--token-spacing-unit) * -1);
    inset-block: calc(var(--token-spacing-unit) * 1);
    width: 2px;
    border-radius: 1px;
    background-color: var(--token-color-active-border);
  }
</style>
