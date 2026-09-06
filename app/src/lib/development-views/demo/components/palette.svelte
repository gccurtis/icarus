<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

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
    "pink"
  ];
  const ACHROMATIC = [
    { hue: "white", note: "warm paper — Helios' planes" },
    { hue: "grey", note: "tint-free — text, in both" },
    { hue: "black", note: "cool void — Selene's planes" }
  ];

  const NAMED = [
    { name: "Aether Blue", entry: "blue-normal", role: "the affordance" },
    { name: "Vesper Violet", entry: "violet-normal", role: "derived work" },
    { name: "Halo Cyan", entry: "cyan-normal", role: "something happening now" }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="02 · Material"
    title="Ladders"
    source="styles/material/material.md"
    lede="Seven steps per family, ordered by lightness. The only literal colour in the repository. It generates no utilities — a component cannot reference it, which is the rule enforced by the build rather than by a check."
  />

  <div class="table-frame table-scroll">
    <div class="min-w-[42rem]">
      <div class="bg-surface-panel border-border-strong grid grid-cols-[7rem_repeat(7,1fr)] border-b">
        <span class="text-micro text-ink-secondary border-border-subtle border-r px-3 py-2 font-mono uppercase tracking-caps">Family</span>
        {#each STEPS as step (step)}
          <span class="text-micro text-ink-secondary px-2 py-2 text-center font-mono uppercase tracking-caps">{step}</span>
        {/each}
      </div>

      {#each CHROMATIC as hue (hue)}
        <div class="border-border-subtle grid grid-cols-[7rem_repeat(7,1fr)] border-b last:border-b-0">
          <span class="text-label text-ink-primary border-border-subtle flex items-center border-r px-3 font-mono">{hue}</span>
          {#each STEPS as step (step)}
            <div
              class="h-10"
              style="background-color: var(--palette-{hue}-{step})"
              title="--palette-{hue}-{step}"
            ></div>
          {/each}
        </div>
      {/each}

      {#each ACHROMATIC as { hue, note } (hue)}
        <div class="border-border-subtle grid grid-cols-[7rem_repeat(7,1fr)] border-b last:border-b-0">
          <span class="border-border-subtle flex flex-col justify-center border-r px-3 py-1">
            <span class="text-label text-ink-primary font-mono">{hue}</span>
            <span class="text-micro text-ink-muted">{note}</span>
          </span>
          {#each STEPS as step (step)}
            <div
              class="h-10"
              style="background-color: var(--palette-{hue}-{step})"
              title="--palette-{hue}-{step}"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <div class="seam-grid grid-cols-1 sm:grid-cols-3">
    {#each NAMED as { name, entry, role } (entry)}
      <div class="flex items-center gap-3 p-4">
        <span
          class="border-border-subtle size-10 shrink-0 rounded-full border"
          style="background-color: var(--palette-{entry})"
        ></span>
        <span class="flex flex-col">
          <span class="text-body-sm font-semibold">{name}</span>
          <span class="text-micro text-ink-muted font-mono">--palette-{entry}</span>
          <span class="text-caption text-ink-secondary">{role}</span>
        </span>
      </div>
    {/each}
  </div>

  <div class="rail rail-quiet max-w-prose p-4">
    <p class="text-body-sm text-ink-secondary m-0">
      Switch the appearance above and only three of these swatches move. Selene overrides
      <code class="text-micro font-mono">blue-deep</code>,
      <code class="text-micro font-mono">violet-deep</code> and
      <code class="text-micro font-mono">grey-strong</code> — the three places where the shared
      ladder does not serve the dark range. Nothing forces the two materials to agree.
    </p>
  </div>
</section>
