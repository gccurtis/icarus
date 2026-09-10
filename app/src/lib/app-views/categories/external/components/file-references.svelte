<script lang="ts">
  import { externalFileInspectorContext } from "$app-views/categories/external/procedures/file-inspector-context.svelte";

  const context = externalFileInspectorContext();
  const file = $derived(context.file());
</script>

<section aria-labelledby="references-heading">
  <div class="section-head"><h3 id="references-heading">References</h3><span>{file.usage.total}</span></div>
  {#if file.usage.items.length === 0}
    <p class="section-copy">Nothing in this project currently references this file.</p>
  {:else}
    <ul class="reference-list">
      {#each file.usage.items as item (`${item.kind}:${item.id}`)}
        <li><span>{item.name}</span><small>{item.kind}</small></li>
      {/each}
    </ul>
    <p class="section-copy">Remove these references before deleting the file.</p>
  {/if}
</section>

<style>
  .section-head { display: flex; align-items: center; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); }
  .section-head > span { color: var(--token-ink-muted); font-size: var(--token-text-caption); }
  h3, p, ul { margin: 0; }
  h3 { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .section-copy, .reference-list { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  .section-copy, .reference-list { margin-top: calc(var(--token-spacing-unit) * 2); }
  .reference-list { display: flex; flex-direction: column; padding: 0; list-style: none; }
  .reference-list li { display: flex; justify-content: space-between; gap: calc(var(--token-spacing-unit) * 2); padding-block: calc(var(--token-spacing-unit) * 1.5); border-bottom: 1px solid var(--token-border-subtle); }
  .reference-list span { overflow: hidden; color: var(--token-ink-secondary); text-overflow: ellipsis; white-space: nowrap; }
  .reference-list small { flex: none; color: var(--token-ink-muted); }
</style>
