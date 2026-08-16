<script lang="ts">
  import type { ResourceRef } from "$model/client";

  /**
   * The `overview` context: what surrounds the active resource at project level.
   *
   * Offered by every resource kind, which is what makes it the shared entry in
   * the panel's map — a context can appear in several kinds' rails by being
   * listed in several arrays.
   *
   * **Fixture content.** It names the resource it is looking at and nothing
   * else. A real project tree needs a capability that does not exist; what this
   * proves is that the panel re-resolves when the active tab changes, which is
   * visible here because the name below changes with it.
   */
  let { resource }: { resource: ResourceRef } = $props();
</script>

<div class="context">
  <h2 class="heading">Overview</h2>
  <p class="note">Looking at <code>{resource.kind}</code> · <code>{resource.id}</code></p>
  <p class="note">A project tree belongs here once a capability can supply one.</p>
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

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
    color: var(--token-ink-primary);
  }
</style>
