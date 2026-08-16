<script lang="ts">
  import type { Component } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import LayoutDashboard from "@lucide/svelte/icons/layout-dashboard";
  import X from "@lucide/svelte/icons/x";

  import { clientModel, type ResourceKind, type ResourceRef } from "$model/client";

  /**
   * The tab bar — which objects are open, and which one is active.
   *
   * It sits in the frame rather than in a route because tabs are workbench
   * state, not route state: opening one is not a navigation and closing one does
   * not go back. This view renders that list and reports two intents to the
   * model; the model owns order, activation, and what happens after a close.
   *
   * **Display copy for a resource kind lives here**, because this is the surface
   * that displays it. The workspace maps the same key to a component. Two maps
   * on one key is deliberate — a label and a component are different decisions,
   * and the model already forces both to be total with
   * `Record<ResourceKind, …>`.
   *
   * A label is a function of the whole resource rather than of its kind alone.
   * Every document tab would otherwise read "Document", which is the one thing a
   * tab strip exists to prevent.
   *
   * **Not an ARIA tablist.** That pattern owes a `tabpanel` relationship and
   * roving tabindex, and a tab whose element also contains a focusable close
   * button is not a `role="tab"`. Each tab is an ordinary button carrying
   * `aria-current`, which is honest about what is implemented; the day these
   * gain arrow-key traversal is the day the roles are worth claiming.
   */
  const RESOURCES: Record<ResourceKind, { label: (of: ResourceRef) => string; icon: Component }> = {
    "project-overview": { label: () => "Overview", icon: LayoutDashboard },
    document: { label: (of) => of.id, icon: FileText }
  };

  const { workbench } = clientModel();
</script>

<div class="tab-bar">
  {#each workbench.tabs as tab (tab.id)}
    {@const entry = RESOURCES[tab.resource.kind]}
    {@const Icon = entry.icon}
    {@const label = entry.label(tab.resource)}
    {@const active = tab.id === workbench.activeId}
    <div class="tab" class:active>
      <button
        type="button"
        class="select"
        aria-current={active ? "true" : undefined}
        onclick={() => workbench.activate(tab.id)}
      >
        <Icon size={14} aria-hidden="true" />
        <span>{label}</span>
      </button>

      <!--
        A permanent tab has no close affordance, and that is a correctness
        requirement rather than a nicety: `close()` throws for one, so offering
        the control would be offering a crash.
      -->
      {#if !tab.permanent}
        <button
          type="button"
          class="close"
          aria-label="Close {label}"
          onclick={() => workbench.close(tab.id)}
        >
          <X size={12} aria-hidden="true" />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .tab-bar {
    height: 100%;
    display: flex;
    align-items: stretch;
    /* Tabs run off the end rather than shrinking to illegibility. This is the
     * one zone that scrolls horizontally. */
    overflow-x: auto;
    scrollbar-width: none;
    padding-inline: calc(var(--token-spacing-unit) * 2);
    background-color: var(--token-surface-panel);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .tab {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .select {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    /* Past the 24px minimum target on both axes once the row is 36px tall. */
    min-height: calc(var(--token-spacing-unit) * 7);
    padding-inline: calc(var(--token-spacing-unit) * 2.5);
    border: none;
    background: none;
    font: inherit;
    font-size: var(--token-text-label);
    line-height: var(--token-text-label-leading);
    white-space: nowrap;
    color: var(--token-ink-muted);
    cursor: pointer;
  }

  .tab:hover .select {
    color: var(--token-ink-primary);
  }

  .active .select {
    color: var(--token-color-active-text);
  }

  .active {
    background-color: var(--token-color-active-surface);
  }

  /* Which tab is active never rides on the tint alone: an underline on the
   * shared edge says it again in shape. */
  .active::after {
    content: "";
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 2px;
    background-color: var(--token-color-active-border);
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--token-spacing-unit) * 6);
    height: calc(var(--token-spacing-unit) * 6);
    margin-inline-end: calc(var(--token-spacing-unit) * 1);
    border: none;
    border-radius: var(--token-radius-control);
    background: none;
    color: var(--token-ink-muted);
    cursor: pointer;
  }

  .close:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }
</style>
