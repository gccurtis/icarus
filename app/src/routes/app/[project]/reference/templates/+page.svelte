<script lang="ts">
  import SystemPage from "$development-views/template-reference/components/system-page.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
</script>

<SystemPage
  material={appearance.current}
  materials={APPEARANCES}
  onmaterial={(next) => (appearance.current = next as Appearance)}
/>
