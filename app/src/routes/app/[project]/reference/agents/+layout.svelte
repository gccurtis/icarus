<script lang="ts">
  import type { Snippet } from "svelte";

  import { page } from "$app/state";

  import DemoShell from "$development-views/demo-shell/demo-shell.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";

  let { children }: { children: Snippet } = $props();
</script>

<DemoShell
  current="/demo/agents-reference"
  appearance={appearance.current}
  appearances={APPEARANCES}
  onappearance={(next) => (appearance.current = next as Appearance)}
>
  {#key page.url.pathname}
    {@render children()}
  {/key}
</DemoShell>
