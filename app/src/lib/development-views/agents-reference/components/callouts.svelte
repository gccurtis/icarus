<script lang="ts">
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import type { Callout } from "$development-views/agents-reference/types";

  let { items, scope = "callout" }: { items: readonly Callout[]; scope?: string } = $props();
</script>

<div class="callouts">
  {#each items as item (item.n)}
    <Noted {scope} label={`${item.n} ${item.title}`}>
      <article class="ar-callout">
        <span class="ar-marker" aria-hidden="true">{item.n}</span>
        <div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </div>
      </article>
    </Noted>
  {/each}
</div>

<style>
  .callouts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
</style>
