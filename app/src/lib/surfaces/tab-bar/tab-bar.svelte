<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import House from "@lucide/svelte/icons/house";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import X from "@lucide/svelte/icons/x";

  import { workspaceState } from "$model/client/workspace-state";
  import { CATEGORY_ENTRIES, isOpened, labelOf } from "$surfaces/tab-bar/procedures/category-entries";

  /**
   * The tab bar — what is open, and which one is active.
   *
   * Tabs are view state, not route state, so the strip sits in the frame rather
   * than in a route. It renders the list and reports two intents; the model owns
   * order, activation, and what happens after a close.
   *
   * The three permanent tabs are written out. `open` on one of those categories
   * finds the tab already there and activates it, so none of them needs an id.
   *
   * **Not an ARIA tablist.** A `role="tab"` makes its children presentational,
   * and these contain a focusable close button. Each is an ordinary button
   * carrying `aria-current`.
   */
  const view = workspaceState();

  const here = $derived(view.active.category);

  /** A label is read once per tab per render; the markup asks for it three times. */
  const opened = $derived(
    view.tabs.filter(isOpened).map((tab) => ({
      tab,
      label: labelOf(tab),
      Icon: CATEGORY_ENTRIES[tab.category].icon
    }))
  );

  const NewTab = CATEGORY_ENTRIES["new-tab"].icon;
</script>

<div class="strip" role="toolbar" aria-label="Open tabs">
  <button
    type="button"
    class="tab icon"
    class:on={here === "project-overview"}
    aria-current={here === "project-overview" ? "page" : undefined}
    title="Overview"
    aria-label="Overview"
    onclick={() => view.open({ category: "project-overview" })}
  >
    <House size={15} aria-hidden="true" />
  </button>

  <button
    type="button"
    class="tab icon"
    class:on={here === "agents"}
    aria-current={here === "agents" ? "page" : undefined}
    title="Agents"
    aria-label="Agents"
    onclick={() => view.open({ category: "agents" })}
  >
    <Bot size={15} aria-hidden="true" />
  </button>

  <button
    type="button"
    class="tab icon"
    class:on={here === "templates"}
    aria-current={here === "templates" ? "page" : undefined}
    title="Templates"
    aria-label="Templates"
    onclick={() => view.open({ category: "templates" })}
  >
    <LayoutTemplate size={15} aria-hidden="true" />
  </button>

  <span class="divider" aria-hidden="true"></span>

  {#each opened as { tab, label, Icon } (tab.id)}
    <div class="tab named" class:on={tab.id === view.activeId}>
      <button
        type="button"
        class="face"
        aria-current={tab.id === view.activeId ? "page" : undefined}
        onclick={() => view.activate(tab.id)}
      >
        <Icon size={14} aria-hidden="true" />
        <span class="truncate">{label}</span>
      </button>
      <button
        type="button"
        class="close"
        title="Close {label}"
        aria-label="Close {label}"
        onclick={() => view.close(tab.id)}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  {/each}

  <button
    type="button"
    class="tab icon"
    title="New tab"
    aria-label="New tab"
    onclick={() => view.open({ category: "new-tab" })}
  >
    <NewTab size={15} aria-hidden="true" />
  </button>
</div>

<style>
  .strip {
    display: flex;
    height: 100%;
    align-items: stretch;
    gap: var(--token-spacing-unit);
    overflow-x: auto;
    padding-inline: calc(var(--token-spacing-unit) * 2);
    background-color: var(--token-surface-panel);
    border-bottom: 1px solid var(--token-border-subtle);
    scrollbar-width: none;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    border-bottom: 2px solid transparent;
    color: var(--token-ink-muted);
  }

  .tab.icon {
    padding-inline: calc(var(--token-spacing-unit) * 2);
  }

  .tab.named {
    max-width: calc(var(--token-spacing-unit) * 44);
    padding-inline-start: calc(var(--token-spacing-unit) * 2);
    padding-inline-end: var(--token-spacing-unit);
  }

  .tab:hover {
    color: var(--token-ink-primary);
  }

  .tab.on {
    border-bottom-color: var(--token-color-active-border);
    color: var(--token-ink-primary);
    background-color: var(--token-surface-canvas);
  }

  .face {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    font-size: var(--token-text-body-sm);
    color: inherit;
  }

  .close {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    border-radius: var(--token-radius-control);
    padding: calc(var(--token-spacing-unit) * 0.5);
    color: var(--token-ink-muted);
  }

  .close:hover {
    background-color: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  /* The permanent set is not a list you edit; the divider says so. */
  .divider {
    align-self: center;
    width: 1px;
    height: calc(var(--token-spacing-unit) * 4);
    background-color: var(--token-border-subtle);
  }
</style>
