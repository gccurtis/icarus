<script lang="ts">
  import SectionHeading from "$views/demo/components/section-heading.svelte";

  const RADII = [
    { token: "control", cls: "rounded-control" },
    { token: "panel", cls: "rounded-panel" },
    { token: "overlay", cls: "rounded-overlay" },
  ];

  const DURATIONS = [
    { token: "micro", cls: "duration-micro" },
    { token: "small", cls: "duration-small" },
    { token: "panel", cls: "duration-panel" },
    { token: "overlay", cls: "duration-overlay" },
  ];

  /** The 4px scale, shown as multiples of the one declared token. Named zone
   * dimensions used to live here; they named an application rather than a
   * design dimension and were removed — see styles/tokens/tokens.md. */
  const STEPS = [
    { cls: "w-1", label: "1 — 4px" },
    { cls: "w-2", label: "2 — 8px" },
    { cls: "w-3", label: "3 — 12px" },
    { cls: "w-4", label: "4 — 16px" },
    { cls: "w-6", label: "6 — 24px" },
    { cls: "w-8", label: "8 — 32px" },
    { cls: "w-12", label: "12 — 48px" },
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading
    title="Geometry and motion"
    source="system/shape.md, spacing.md, motion/component.md"
  />

  <h3 class="text-h4 font-semibold">Spacing scale</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    One declared token, <code class="font-mono">--token-spacing-unit: 0.25rem</code>, and every step is a
    multiple of it. Nothing lands off-grid.
  </p>
  <div class="flex flex-col gap-1">
    {#each STEPS as { cls, label } (cls)}
      <div class="flex items-center gap-3">
        <span class="text-caption text-ink-muted w-20 shrink-0 font-mono">{label}</span>
        <div class="bg-interactive-fill rounded-control h-3 {cls}"></div>
      </div>
    {/each}
  </div>

  <h3 class="text-h4 font-semibold">Radii</h3>
  <div class="flex flex-wrap gap-4">
    {#each RADII as { token, cls } (token)}
      <div class="flex flex-col items-center gap-2">
        <div class="bg-surface-panel border-border-subtle size-20 border {cls}"></div>
        <span class="text-caption text-ink-muted font-mono">--token-radius-{token}</span>
      </div>
    {/each}
  </div>

  <h3 class="text-h4 font-semibold">Elevation</h3>
  <div class="flex flex-wrap gap-4">
    <div class="bg-surface-panel border-border-subtle rounded-panel border p-4">
      <span class="text-label">Bounded</span>
    </div>
    <div class="bg-surface-panel border-border-subtle rounded-panel shadow-panel border p-4">
      <span class="text-label">Raised — shadow-panel</span>
    </div>
    <div class="bg-surface-elevated border-border-subtle rounded-overlay shadow-overlay border p-4">
      <span class="text-label">Floating — shadow-overlay</span>
    </div>
  </div>

  <h3 class="text-h4 font-semibold">Motion</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    One easing curve, four durations. Hover a swatch — each transitions at its own duration. All of
    it collapses under <code class="font-mono">prefers-reduced-motion</code>.
  </p>
  <div class="flex flex-wrap gap-3">
    {#each DURATIONS as { token, cls } (token)}
      <div
        class="bg-surface-panel hover:bg-interactive-surface border-border-subtle rounded-control ease-standard cursor-default border px-4 py-3 transition-colors {cls}"
      >
        <span class="text-label font-mono">--token-motion-{token}</span>
      </div>
    {/each}
  </div>
</section>
