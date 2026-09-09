<script lang="ts">
  import IntegrationPage from "$development-views/template-reference/components/integration-page.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
</script>

<IntegrationPage
  material={appearance.current}
  materials={APPEARANCES}
  onmaterial={(next) => (appearance.current = next as Appearance)}
/>
