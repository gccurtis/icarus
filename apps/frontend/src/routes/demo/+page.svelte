<script lang="ts">
  /**
   * /demo — the design system reference.
   *
   * Every value on this page resolves through the token chain; nothing is
   * hard-coded. That makes the page a live test as well as a reference: if a
   * swatch renders transparent, a token was tree-shaken out of the build.
   *
   * Split one file per section deliberately. The previous version was a single
   * 458-line component, which is past the size where a file is worth reading.
   */
  import Components from "$lib/demo/components.svelte";
  import Geometry from "$lib/demo/geometry.svelte";
  import Palette from "$lib/demo/palette.svelte";
  import Roles from "$lib/demo/roles.svelte";
  import States from "$lib/demo/states.svelte";
  import Surfaces from "$lib/demo/surfaces.svelte";
  import Typography from "$lib/demo/typography.svelte";
  import { Separator } from "$lib/simple-components/separator";
</script>

<svelte:head>
  <title>Design system — Icarus</title>
</svelte:head>

<div class="mx-auto flex max-w-5xl flex-col gap-10 p-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-h1 font-semibold">Design system</h1>
    <p class="text-body text-ink-secondary max-w-[70ch]">
      Every value below resolves through the palette. Nothing on this page is hard-coded — each
      swatch reads a token, so the whole surface moves with the theme.
    </p>
  </header>

  <Palette />
  <Separator />
  <Roles />
  <Separator />
  <Surfaces />
  <Separator />
  <Typography />
  <Separator />
  <Components />
  <Separator />
  <States />
  <Separator />
  <Geometry />
</div>
