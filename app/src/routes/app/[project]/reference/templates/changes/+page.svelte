<script lang="ts">
  import ChangesPage from "$development-views/template-reference/components/changes-page.svelte";
  import {
    APPEARANCES,
    appearance,
    type Appearance
  } from "$surfaces/top-bar/effects/apply-appearance.svelte";
</script>

<ChangesPage
  material={appearance.current}
  materials={APPEARANCES}
  onmaterial={(next) => (appearance.current = next as Appearance)}
/>
