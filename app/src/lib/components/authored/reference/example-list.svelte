<script lang="ts">
  import type { Example } from "$authored-components/reference/types";

  let { examples }: { examples: readonly Example[] } = $props();
</script>

<div class="examples">
  {#each examples as example (example.expression)}
    <div class="example">
      <span class="expression">{example.expression}</span>
      <span>
        <span class="answers">{example.answers}</span>
        <span class="kind">{example.kind}</span>
      </span>
      {#if example.note}
        <p class="note">{example.note}</p>
      {/if}
    </div>
  {/each}
</div>
