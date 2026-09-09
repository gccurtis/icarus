<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    eyebrow,
    title,
    lede,
    children
  }: { id: string; eyebrow: string; title: string; lede: string; children: Snippet } = $props();
</script>

<section {id} class="reb-section">
  <header class="reb-section-head">
    <div><span>{eyebrow}</span><h2>{title}</h2></div>
    <p>{lede}</p>
  </header>
  <div class="reb-section-body">{@render children()}</div>
</section>
