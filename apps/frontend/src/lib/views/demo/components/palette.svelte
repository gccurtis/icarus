<script lang="ts">
  import SectionHeading from "$views/demo/components/section-heading.svelte";

  const STEPS = ["faded", "light", "muted", "normal", "emphasized", "strong", "deep"];
  const CHROMATIC = [
    "red",
    "orange",
    "amber",
    "yellow",
    "green",
    "teal",
    "cyan",
    "blue",
    "violet",
    "pink",
  ];
  const NEUTRAL = ["white", "grey", "black"];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Palette" source="styles/chromatic-themes/&lt;theme&gt;/&lt;theme&gt;.md" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    The theme's own material, ordered by lightness. This is the only layer holding literal color
    values, and the only one a theme swap replaces. It generates no utilities — a component cannot
    reference it, which is the docs' rule enforced by the build.
  </p>

  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-[6rem_repeat(7,1fr)] items-center gap-1">
      <span></span>
      {#each STEPS as step (step)}
        <span class="text-caption text-ink-muted text-center">{step}</span>
      {/each}
    </div>

    <!-- Read through an inline var() rather than a utility: the palette lives
         outside @theme, so no bg-palette-* class exists to write. -->
    {#each [...CHROMATIC, ...NEUTRAL] as hue (hue)}
      <div class="grid grid-cols-[6rem_repeat(7,1fr)] items-center gap-1">
        <span class="text-label text-ink-secondary font-mono">{hue}</span>
        {#each STEPS as step (step)}
          <div
            class="border-border-subtle rounded-control h-8 border"
            style="background-color: var(--palette-{hue}-{step})"
            title="--palette-{hue}-{step}"
          ></div>
        {/each}
      </div>
    {/each}
  </div>
</section>
