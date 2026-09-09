<script lang="ts">
  import type { Card } from "$authored-components/reference/types";

  let { cards }: { cards: readonly Card[] } = $props();
</script>

<div class="cards">
  {#each cards as card (card.title)}
    <div class="card" class:ruled={card.tone === "ruled"}>
      <h3>
        {card.title}
        {#if card.tag}<span class="tag {card.tone ?? 'proposed'}">{card.tag}</span>{/if}
      </h3>
      <p>{card.detail}</p>
    </div>
  {/each}
</div>
