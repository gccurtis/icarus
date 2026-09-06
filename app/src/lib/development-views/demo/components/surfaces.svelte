<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const PLANES = [
    { token: "canvas", cls: "bg-surface-canvas", role: "The ground everything rests on" },
    { token: "work", cls: "bg-surface-work", role: "Where the work happens — nearest the light" },
    { token: "panel", cls: "bg-surface-panel", role: "Chrome flanking the work" },
    { token: "panel-hover", cls: "bg-surface-panel-hover", role: "The neutral hover plane" },
    { token: "elevated", cls: "bg-surface-elevated", role: "Something floating clear" },
    { token: "pasteboard", cls: "bg-surface-pasteboard", role: "The void a document floats in" }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="03 · Light"
    title="Planes and depth"
    source="styles/aesthetic/light.md"
    lede="A plane is a claim about distance from the reader. Six of them, and no screen needs a seventh. They are separated by lightness, not by lines — a shell that needs a border to say this is a different region has not made the planes do their work."
  />

  <div class="surface-seam-grid grid-cols-2 lg:grid-cols-6">
    {#each PLANES as { token, cls, role } (token)}
      <div class="flex flex-col gap-2 p-3">
        <span class="border-border-subtle h-16 rounded-md border {cls}"></span>
        <span class="text-micro font-mono">{token}</span>
        <span class="text-caption text-ink-muted">{role}</span>
      </div>
    {/each}
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Ink</h3>
      <div class="flex flex-col gap-1">
        <p class="text-body text-ink-primary m-0">Primary — body and headings</p>
        <p class="text-body text-ink-secondary m-0">Secondary — supporting text, provenance</p>
        <p class="text-body text-ink-muted m-0">Muted — metadata a reader may skip</p>
        <p class="text-body m-0 flex flex-wrap items-center gap-2">
          <span class="bg-interactive-fill text-ink-on-fill rounded-control text-label px-2 py-0.5">
            on-fill
          </span>
          <span class="text-ink-secondary text-body-sm">never on a plane, only on a solid</span>
        </p>
      </div>

      <h3 class="text-h4 mt-2 font-semibold">Selection</h3>
      <p class="text-body-sm text-ink-secondary max-w-prose m-0">
        <span class="bg-surface-selection">Select this sentence</span> — the wash is derived rather
        than authored, so it tracks the engaged hue. It is held while an editor is blurred, so a
        selection stays visible when focus moves to an inspector.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Depth is a claim, not a decoration</h3>
      <div class="flex flex-wrap gap-4">
        <div class="bg-surface-elevated shadow-panel rounded-panel flex h-20 w-40 items-end p-3">
          <span class="text-micro font-mono">panel</span>
        </div>
        <div class="bg-surface-elevated shadow-raised rounded-panel flex h-20 w-40 items-end p-3">
          <span class="text-micro font-mono">raised</span>
        </div>
        <div class="bg-surface-elevated shadow-overlay rounded-panel flex h-20 w-40 items-end p-3">
          <span class="text-micro font-mono">overlay</span>
        </div>
      </div>

      <h3 class="text-h4 mt-2 font-semibold">Glow carries state, and nothing else</h3>
      <div class="flex flex-wrap items-center gap-4">
        <span class="bg-surface-elevated border-border-subtle rounded-control shadow-glow flex items-center gap-2 border px-3 py-2">
          <span class="surface-live-dot"></span>
          <span class="text-body-sm">Resolving</span>
        </span>
        <span class="bg-surface-elevated border-border-subtle rounded-control flex items-center gap-2 border px-3 py-2">
          <span class="text-body-sm text-ink-muted">At rest — no glow</span>
        </span>
      </div>
    </div>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="flex flex-col gap-2">
      <h3 class="text-h4 font-semibold">The veil</h3>
      <div class="border-border-subtle rounded-panel bg-surface-pasteboard relative h-32 overflow-hidden border">
        <p class="text-body-sm text-ink-secondary p-3">
          Content continuing underneath is what tells a person the region is still there. Solid
          chrome over moving content reads as a lid; a veil reads as glass.
        </p>
        <div class="surface-veil border-border-subtle absolute inset-x-0 bottom-0 border-t px-3 py-2">
          <span class="text-micro font-mono">surface-veil + blur-veil</span>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <h3 class="text-h4 font-semibold">Inversion</h3>
      <div class="surface-inverted flex h-32 flex-col justify-end p-4">
        <span class="surface-eyebrow">One per screen</span>
        <p class="text-body-sm m-0 mt-1 opacity-80">
          A statement rather than a region. Two inverted blocks on a screen is one too many; the
          second costs the first its meaning.
        </p>
      </div>
    </div>
  </div>
</section>
