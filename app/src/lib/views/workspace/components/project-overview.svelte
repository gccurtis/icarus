<script lang="ts">
  import { clientModel, type Tab, type TabTarget } from "$model/client";

  /**
   * What a `project-overview` resource renders as.
   *
   * The first singleton, so this is what the work surface shows on a first load
   * and whenever every closable tab has been closed.
   *
   * **A fixture, and the only caller of `open()` in the application.** The list
   * below stands in for a project's contents until a capability can supply one.
   * What is real is the opening: `open()` mints a tab, or activates the one
   * already holding that resource — it dedupes on type *and* id, so pressing the
   * same entry twice returns to the tab rather than making a second.
   */
  let { tab }: { tab: Tab } = $props();

  const { workbench } = clientModel();

  // The tab is not read: this screen is a singleton, so there is nothing about
  // it that varies. It takes the prop because every screen root has the same
  // signature, which is what lets the workspace hold one total map.
  // svelte-ignore state_referenced_locally
  void tab;

  const DOCUMENTS = ["Weekly notes", "Interview 03", "Q3 findings"];

  const documentTarget = (name: string): TabTarget => ({
    kind: "resource",
    resourceType: "document",
    resourceId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  });
</script>

<div class="overview">
  <div class="panel">
    <h2 class="heading">Project overview</h2>
    <p class="note">Open one, and the tab bar, the context rail, and this surface all follow it.</p>

    <ul class="documents">
      {#each DOCUMENTS as name (name)}
        <li>
          <button type="button" class="entry" onclick={() => workbench.open(documentTarget(name))}>
            {name}
          </button>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .overview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: calc(var(--token-spacing-unit) * 6);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    width: 100%;
    max-width: 32rem;
  }

  .heading {
    font-size: var(--token-text-h4);
    line-height: var(--token-text-h4-leading);
    font-weight: 600;
    margin: 0;
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }

  .documents {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entry {
    width: 100%;
    /* Past the 24px minimum target with room to spare. */
    min-height: calc(var(--token-spacing-unit) * 9);
    display: flex;
    align-items: center;
    padding-inline: calc(var(--token-spacing-unit) * 3);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-panel);
    font: inherit;
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-primary);
    text-align: start;
    cursor: pointer;
  }

  .entry:hover {
    background-color: var(--token-surface-panel-hover);
    border-color: var(--token-color-interactive-border);
  }
</style>
