<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";

  import { LanguageHeader } from "$authored-components/reference";
  import { NAV, slugOf } from "$app-views/general/formula-language-reference/procedures/navigation";
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
    nav={NAV}
    {current}
    appearance={appearance.current}
    appearances={APPEARANCES}
    onappearance={(next) => (appearance.current = next as Appearance)}
  />
{/if}

{@render children()}
