<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";

  import LanguageHeader from "$development-views/formula-language-reference/components/language-header.svelte";
  import { slugOf } from "$development-views/formula-language-reference/procedures/navigation";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";

  let { children }: { children: Snippet } = $props();

  const current = $derived(slugOf(page.url.pathname));
</script>

{#if current}
  <LanguageHeader
    {current}
    appearance={appearance.current}
    appearances={APPEARANCES}
    onappearance={(next) => (appearance.current = next as Appearance)}
  />
{/if}

{@render children()}
