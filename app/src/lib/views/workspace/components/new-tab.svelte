<script lang="ts">
  import { clientModel, type Tab, type TabTarget } from "$model/client";

  /**
   * The launcher — what a new tab shows until it becomes something.
   *
   * **The one screen that ends its own tab's life as that screen.** Picking an
   * entry calls `resolveLauncher`, which turns *this* tab into the thing it
   * created, keeping the same id and the same slot in the strip. A user who
   * typed here and picked a document watches this tab become the document,
   * rather than watching a tab vanish and another appear at the far end.
   *
   * If the target is already open elsewhere, `resolveLauncher` activates that
   * tab and closes this one instead — two tabs on one document is the thing the
   * model's identity function exists to prevent.
   *
   * **Fixture content.** The list stands in for search over a project's
   * contents until a capability can supply one. What is real is the resolution.
   */
  let { tab }: { tab: Tab } = $props();

  const { workbench } = clientModel();

  const DOCUMENTS = ["Weekly notes", "Interview 03", "Q3 findings"];

  const documentTarget = (name: string): TabTarget => ({
    kind: "resource",
    resourceType: "document",
    resourceId: name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  });

  const query = $derived(tab.viewState.kind === "new-tab" ? tab.viewState.query : "");

  const matches = $derived(
    DOCUMENTS.filter((name) => name.toLowerCase().includes(query.toLowerCase()))
  );
</script>

<section class="launcher">
  <input
    class="query"
    type="search"
    placeholder="Search this project"
    aria-label="Search this project"
    value={query}
    oninput={(event) =>
      workbench.update(tab.id, "new-tab", { query: event.currentTarget.value })}
  />

  <ul class="results">
    {#each matches as name (name)}
      <li>
        <button
          type="button"
          class="entry"
          onclick={() => workbench.resolveLauncher(tab.id, documentTarget(name))}
        >
          {name}
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .launcher {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 6);
    max-width: 40rem;
    margin-inline: auto;
  }

  .query {
    width: 100%;
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background-color: var(--token-surface-input);
    color: var(--token-ink-primary);
    font-size: var(--token-type-body-size);
  }

  .results {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
  }

  .entry {
    width: 100%;
    text-align: start;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    border: none;
    border-radius: var(--token-radius-control);
    background: none;
    color: var(--token-ink-primary);
    font-size: var(--token-type-body-size);
    cursor: pointer;
  }

  .entry:hover {
    background-color: var(--token-surface-panel-hover);
  }
</style>
