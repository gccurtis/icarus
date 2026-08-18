<script lang="ts">
  import { screenKindOf, type Tab } from "$model/client";

  /**
   * The `outline` context: the structure of the resource being looked at.
   *
   * Offered by `document` and not by `project-overview`, which is what makes the
   * rail itself change when the active tab does — the clearest demonstration
   * that `availableContexts` is derived from the active tab's kind rather than
   * held anywhere.
   *
   * **Fixture content.** The headings below are static. Reading a document's
   * real structure needs a document capability, and inventing a shared store to
   * fake one would be a worse lie than a visibly static list.
   */
  let { tab }: { tab: Tab } = $props();

  const HEADINGS = ["Summary", "Findings", "Open questions"];
</script>

<div class="context">
  <h2 class="heading">Outline</h2>
  <p class="note"><code>{tab.target.kind === "resource" ? tab.target.resourceId : screenKindOf(tab.target)}</code></p>
  <ol class="entries">
    {#each HEADINGS as heading (heading)}
      <li>{heading}</li>
    {/each}
  </ol>
</div>

<style>
  .context {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .heading {
    font-size: var(--token-text-label);
    font-weight: 600;
    color: var(--token-ink-secondary);
    margin: 0;
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: var(--token-spacing-unit);
    margin: 0;
    padding-inline-start: calc(var(--token-spacing-unit) * 4);
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-secondary);
  }

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
    color: var(--token-ink-primary);
  }
</style>
