<script lang="ts">
  import SectionHeading from "$lib/demo/section-heading.svelte";

  const SURFACES = [
    { token: "canvas", cls: "bg-surface-canvas", role: "Atmospheric field" },
    { token: "work", cls: "bg-surface-work", role: "Reading and editing plane" },
    { token: "panel", cls: "bg-surface-panel", role: "Context, inspector, cards" },
    { token: "elevated", cls: "bg-surface-elevated", role: "Overlays and drawers" },
    { token: "panel-hover", cls: "bg-surface-panel-hover", role: "Neutral hover plane" },
  ];

  const BORDERS = [
    { name: "subtle", cls: "bg-border-subtle", use: "Panel seams, control boundaries, table rules" },
    { name: "strong", cls: "bg-border-strong", use: "Emphasis, active boundaries, dense grid axes" },
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Surfaces and ink" source="styles/tokens/tokens.md" />

  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
    {#each SURFACES as { token, cls, role } (token)}
      <div class="border-border-subtle rounded-panel flex flex-col gap-2 border p-4 {cls}">
        <span class="text-label font-mono">--token-surface-{token}</span>
        <span class="text-caption text-ink-muted">{role}</span>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-1">
    <p class="text-body text-ink-primary">--token-ink-primary — body and headings</p>
    <p class="text-body text-ink-secondary">--token-ink-secondary — supporting text, provenance</p>
    <p class="text-body text-ink-muted">--token-ink-muted — metadata a reader may skip</p>
    <!-- on-fill is the only ink that cannot be shown on a plane: it is defined
         by what reads on a solid role fill, which is why each theme declares it
         rather than the system. -->
    <p class="text-body text-ink-primary flex flex-wrap items-center gap-2">
      <span class="bg-interactive-fill text-ink-on-fill rounded-control text-label px-2 py-0.5">
        --token-ink-on-fill
      </span>
      <span>— text and icons on a solid fill, never on a plane</span>
    </p>
  </div>

  <h3 class="text-h4 mt-2 font-semibold">Borders</h3>
  <div class="flex flex-wrap gap-4">
    {#each BORDERS as { name, cls, use } (name)}
      <div class="flex flex-col gap-2">
        <div class="rounded-control h-8 w-56 {cls}"></div>
        <span class="text-label font-mono">--token-border-{name}</span>
        <span class="text-caption text-ink-muted">{use}</span>
      </div>
    {/each}
  </div>

  <h3 class="text-h4 mt-2 font-semibold">Selection</h3>
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    <span class="bg-surface-selection">Select this sentence</span> — the wash is derived rather than
    authored, so it tracks the engaged hue through whichever theme and semantic set are active. It is
    held while an editor is blurred, so a selection stays visible when focus moves to an inspector.
  </p>
</section>
