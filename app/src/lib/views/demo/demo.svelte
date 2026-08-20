<script lang="ts">
  /**
   * Every value on this page resolves through the token chain; nothing is
   * hard-coded. That makes the page a live test as well as a reference: if a
   * swatch renders transparent, a token was tree-shaken out of the build.
   */
  import AppearanceBar from "$views/demo/components/appearance-bar.svelte";
  import Controls from "$views/demo/components/controls.svelte";
  import Data from "$views/demo/components/data.svelte";
  import DemoIndex from "$views/demo/components/demo-index.svelte";
  import Disclosure from "$views/demo/components/disclosure.svelte";
  import Feedback from "$views/demo/components/feedback.svelte";
  import Geometry from "$views/demo/components/geometry.svelte";
  import Overlays from "$views/demo/components/overlays.svelte";
  import Palette from "$views/demo/components/palette.svelte";
  import RegistryComponents from "$views/demo/components/registry-components.svelte";
  import Roles from "$views/demo/components/roles.svelte";
  import States from "$views/demo/components/states.svelte";
  import Structure from "$views/demo/components/structure.svelte";
  import Surfaces from "$views/demo/components/surfaces.svelte";
  import Typography from "$views/demo/components/typography.svelte";
  import { Separator } from "$lib/simple-components/separator";
</script>

<svelte:head>
  <title>Design system — Icarus</title>
</svelte:head>

<AppearanceBar />

<div class="mx-auto flex max-w-5xl flex-col gap-10 p-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-h1 font-semibold">Design system</h1>
    <p class="text-body text-ink-secondary max-w-[70ch]">
      Every value below resolves through the palette. Nothing on this page is hard-coded — each
      swatch reads a token, so the whole surface moves with the theme.
    </p>
  </header>

  <DemoIndex />
  <Separator />

  <Palette />
  <Separator />
  <Roles />
  <Separator />
  <Surfaces />
  <Separator />
  <Typography />
  <Separator />
  <RegistryComponents />
  <Separator />
  <Overlays />
  <Separator />
  <Disclosure />
  <Separator />
  <Controls />
  <Separator />
  <Feedback />
  <Separator />
  <Data />
  <Separator />
  <Structure />
  <Separator />
  <States />
  <Separator />
  <Geometry />
</div>
