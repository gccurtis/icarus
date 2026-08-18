<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A screen root that has nothing behind it yet.
   *
   * **Deliberately visible as unbuilt.** Every screen kind needs a component for
   * the workspace's map to be total — that totality is what makes adding a
   * screen kind fail to compile until something renders it — but inventing a
   * plausible-looking surface for one whose capability does not exist produces a
   * demo nobody can tell from the real thing.
   *
   * The tab, the rail, the inspector and the frame around it are all real, so
   * everything about the shell can be exercised through one of these.
   */
  let { title, children }: { title: string; children?: Snippet } = $props();
</script>

<section class="placeholder">
  <h1 class="title">{title}</h1>
  <p class="note">This screen has no capability behind it yet.</p>
  {#if children}
    <div class="detail">{@render children()}</div>
  {/if}
</section>

<style>
  .placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--token-spacing-unit);
    padding: calc(var(--token-spacing-unit) * 4);
    text-align: center;
  }

  .title {
    font-size: var(--token-type-title-size);
    font-weight: var(--token-type-title-weight);
    color: var(--token-ink-primary);
  }

  .note {
    font-size: var(--token-type-body-size);
    color: var(--token-ink-muted);
  }

  .detail {
    font-family: var(--token-type-mono-family);
    font-size: var(--token-type-caption-size);
    color: var(--token-ink-subtle);
  }
</style>
