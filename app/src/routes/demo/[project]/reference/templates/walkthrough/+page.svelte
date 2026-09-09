<script lang="ts">
  import WalkthroughPage from "$development-views/template-reference/components/walkthrough-page.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
</script>

<WalkthroughPage
  material={appearance.current}
  materials={APPEARANCES}
  onmaterial={(next) => (appearance.current = next as Appearance)}
/>
