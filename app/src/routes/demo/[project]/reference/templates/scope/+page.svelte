<script lang="ts">
  import ScopePage from "$development-views/template-reference/components/scope-page.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
</script>

<ScopePage
  material={appearance.current}
  materials={APPEARANCES}
  onmaterial={(next) => (appearance.current = next as Appearance)}
/>
