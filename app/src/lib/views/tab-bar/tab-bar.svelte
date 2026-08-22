<script lang="ts">
  import X from "@lucide/svelte/icons/x";

  import { isSingleton, viewState } from "$model/client/view-state";
  import { SCREEN_ENTRIES, labelOf } from "$views/tab-bar/procedures/screen-entries";

  /**
   * The tab bar — what is open, and which one is active.
   *
   * It sits in the frame rather than in a route because tabs are view state, not
   * route state: opening one is not a navigation and closing one does not go
   * back. This view renders the list and reports two intents; the model owns
   * order, activation, and what happens after a close.
   *
   * **The strip separates the permanent from the opened.** The seven singletons
   * are icon-only behind a divider — they are always there, so a label on each
   * spends the width that the tabs a person actually opened need for their names.
   *
   * **Not an ARIA tablist.** That pattern owes a `tabpanel` relationship and
   * roving tabindex, and a tab whose element also contains a focusable close
   * button is not a `role="tab"`. Each is an ordinary button carrying
   * `aria-current`, which is honest about what is implemented.
   */
  const view = viewState();

  const permanent = $derived(view.tabs.filter((tab) => isSingleton(tab.screen)));
  const opened = $derived(view.tabs.filter((tab) => !isSingleton(tab.screen)));

  /** Hoisted: a component position takes a name or a dotted path, not an index. */
  const NewTab = SCREEN_ENTRIES["new-tab"].icon;
</script>

<div class="strip" role="toolbar" aria-label="Open tabs">
  {#each permanent as tab (tab.id)}
    {@const entry = SCREEN_ENTRIES[tab.screen]}
    <button
      type="button"
      class="tab icon"
      class:on={tab.id === view.activeId}
      aria-current={tab.id === view.activeId ? "page" : undefined}
      title={labelOf(tab)}
      aria-label={labelOf(tab)}
      onclick={() => view.activate(tab.id)}
    >
      <entry.icon size={15} aria-hidden="true" />
    </button>
  {/each}

  <span class="divider" aria-hidden="true"></span>

  {#each opened as tab (tab.id)}
    {@const entry = SCREEN_ENTRIES[tab.screen]}
    <div class="tab named" class:on={tab.id === view.activeId}>
      <button
        type="button"
        class="face"
        aria-current={tab.id === view.activeId ? "page" : undefined}
        onclick={() => view.activate(tab.id)}
      >
        <entry.icon size={14} aria-hidden="true" />
        <span class="truncate">{labelOf(tab)}</span>
      </button>
      <button
        type="button"
        class="close"
        title="Close {labelOf(tab)}"
        aria-label="Close {labelOf(tab)}"
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
    onclick={() => view.open({ screen: "new-tab" })}
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
    background-color: var(--token-surface-hover);
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
