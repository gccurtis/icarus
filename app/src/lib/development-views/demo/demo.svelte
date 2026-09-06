<script lang="ts">
  import Arrangement from "$development-views/demo/components/arrangement.svelte";
  import Controls from "$development-views/demo/components/controls.svelte";
  import Data from "$development-views/demo/components/data.svelte";
  import DemoIndex from "$development-views/demo/components/demo-index.svelte";
  import Disclosure from "$development-views/demo/components/disclosure.svelte";
  import Feedback from "$development-views/demo/components/feedback.svelte";
  import Laws from "$development-views/demo/components/laws.svelte";
  import Motion from "$development-views/demo/components/motion.svelte";
  import Overlays from "$development-views/demo/components/overlays.svelte";
  import Palette from "$development-views/demo/components/palette.svelte";
  import RegistryComponents from "$development-views/demo/components/registry-components.svelte";
  import Roles from "$development-views/demo/components/roles.svelte";
  import SectionNav from "$development-views/demo/components/section-nav.svelte";
  import States from "$development-views/demo/components/states.svelte";
  import Structure from "$development-views/demo/components/structure.svelte";
  import Surfaces from "$development-views/demo/components/surfaces.svelte";
  import Typography from "$development-views/demo/components/typography.svelte";
</script>

<svelte:head>
  <title>Celestial — Icarus</title>
</svelte:head>

<div class="flex min-h-0 flex-1 flex-col lg:flex-row">
  <SectionNav />

  <div class="flex min-w-0 flex-1 flex-col">
    <header class="flex flex-col gap-6 px-6 pt-14 pb-12 lg:px-10">
      <div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-end">
        <div class="flex flex-col gap-5">
          <span class="eyebrow">Celestial · the design system</span>
          <h1 class="text-display tracking-display max-w-title font-semibold text-balance">
            A formless citadel amongst the clouds.
          </h1>
          <p class="font-reading text-body-lg leading-reading text-ink-secondary max-w-lede m-0">
            Whose curves channel the manifestation of the solar will. Every value on this page
            resolves through the token chain — nothing is hard-coded, so the whole surface moves
            when the appearance does.
          </p>
        </div>

        <aside class="rail rail-intelligence flex flex-col gap-2 p-4">
          <span class="eyebrow">Two materials</span>
          <p class="text-body-sm text-ink-secondary m-0">
            <strong class="text-ink-primary">Helios</strong> is the will manifest directly — day,
            warm paper, the source. <strong class="text-ink-primary">Selene</strong> is the same
            will returned by another body — night, cool void, reflection.
          </p>
          <p class="text-caption text-ink-muted m-0">
            They are not required to mirror each other. They are required to be good.
          </p>
        </aside>
      </div>
    </header>

    <div class="flex flex-col gap-16 px-6 pb-24 lg:px-10">
      <div id="laws" class="scroll-mt-16"><Laws /></div>

      <div id="material" class="flex scroll-mt-16 flex-col gap-16">
        <Palette />
        <Roles />
      </div>

      <div id="light" class="scroll-mt-16"><Surfaces /></div>
      <div id="type" class="scroll-mt-16"><Typography /></div>
      <div id="motion" class="scroll-mt-16"><Motion /></div>
      <div id="arrangement" class="scroll-mt-16"><Arrangement /></div>
      <div id="states" class="scroll-mt-16"><States /></div>

      <div id="registry" class="flex scroll-mt-16 flex-col gap-16">
        <RegistryComponents />
        <Overlays />
        <Disclosure />
        <Controls />
        <Feedback />
        <Data />
        <Structure />
      </div>

      <DemoIndex />
    </div>
  </div>
</div>
