<script lang="ts">
  import type { Snippet } from "svelte";

  import Noted from "$development-views/agents-reference/components/noted.svelte";

  let {
    id,
    kicker,
    title,
    lede,
    children
  }: {
    id: string;
    kicker: string;
    title: string;
    lede: string;
    children: Snippet;
  } = $props();
</script>

<section class="ar-section" {id}>
  <Noted scope="section" label={title}>
    <div class="ar-section-head">
      <div>
        <span class="ar-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      <p>{lede}</p>
    </div>
  </Noted>
  <div class="ar-body">
    {@render children()}
  </div>
</section>
