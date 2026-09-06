<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const SCALE = [
    { cls: "text-h1", token: "h1", use: "Major screen or page title" },
    { cls: "text-h2", token: "h2", use: "Document section or modal title" },
    { cls: "text-h3", token: "h3", use: "Panel major heading, object title" },
    { cls: "text-h4", token: "h4", use: "Inspector and drawer section heading" },
    { cls: "text-body-lg", token: "body-lg", use: "A lede" },
    { cls: "text-body", token: "body", use: "The default" },
    { cls: "text-body-sm", token: "body-sm", use: "Dense rows, secondary copy" },
    { cls: "text-label", token: "label", use: "Control labels" },
    { cls: "text-caption", token: "caption", use: "Metadata under content" },
    { cls: "text-micro", token: "micro", use: "Panel chrome, eyebrows, units" }
  ];

  const TRACKING = [
    { cls: "tracking-display", token: "display", why: "Large type at default tracking reads as unset" },
    { cls: "tracking-heading", token: "heading", why: "Headings tighten, but less than display" },
    { cls: "tracking-body", token: "body", why: "The face is drawn for this" },
    { cls: "tracking-label", token: "label", why: "A hair of air at small sizes" },
    { cls: "tracking-caps", token: "caps", why: "Uppercase without it is unreadable, not stylish" }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="04 · Type"
    title="Three voices"
    source="styles/aesthetic/type.md"
    lede="The product has three kinds of thing to say and they should not sound alike. The serif is the one that changes how the product feels, and the one most easily skipped — a document set in the interface font tells the reader the page is part of the application."
  />

  <div class="seam-grid grid-cols-1 lg:grid-cols-3">
    <div class="flex flex-col gap-2 p-4">
      <span class="eyebrow">Instrument</span>
      <p class="font-sans text-body-lg m-0">Bold, Italic, Underline</p>
      <p class="text-caption text-ink-muted m-0">
        Every control, label, panel, heading and table. IBM Plex Sans.
      </p>
    </div>
    <div class="flex flex-col gap-2 p-4">
      <span class="eyebrow">Reading</span>
      <p class="font-reading text-body-lg leading-reading m-0">
        The citadel's curves channel light rather than emit it.
      </p>
      <p class="text-caption text-ink-muted m-0">
        Document prose, quoted source text, long-form reading. IBM Plex Serif.
      </p>
    </div>
    <div class="flex flex-col gap-2 p-4">
      <span class="eyebrow">Identifier</span>
      <p class="font-mono text-body m-0 tabular-nums">2026-09-05T18:41:07.284Z</p>
      <p class="text-caption text-ink-muted m-0">
        Ids, commits, addresses, keys, measured numbers. Never a paragraph.
      </p>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">The scale</h3>
      <p class="text-body-sm text-ink-secondary max-w-prose m-0">
        Each step is a size paired with a leading. Setting one without the other is a defect,
        because the rhythm is the point.
      </p>
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-baseline gap-x-4">
          <span class="text-micro text-ink-muted w-20 shrink-0 font-mono">display</span>
          <span class="text-display tracking-display font-semibold">Celestial</span>
        </div>
        {#each SCALE as { cls, token, use } (token)}
          <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span class="text-micro text-ink-muted w-20 shrink-0 font-mono">{token}</span>
            <span class={cls}>The work surface is sacred</span>
            <span class="text-caption text-ink-muted">{use}</span>
          </div>
        {/each}
      </div>

      <h3 class="text-h4 mt-2 font-semibold">Measure</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        Line length is the most reliable difference between a page that has been set and a page that
        has been dumped. A block of text with no measure is a defect, not a default.
      </p>
      <div class="flex flex-col gap-2">
        <span class="bg-interactive-surface border-interactive-border max-w-title h-6 rounded-sm border"></span>
        <span class="text-micro text-ink-muted font-mono">title — 24ch</span>
        <span class="bg-interactive-surface border-interactive-border max-w-note h-6 rounded-sm border"></span>
        <span class="text-micro text-ink-muted font-mono">note — 52ch</span>
        <span class="bg-interactive-surface border-interactive-border max-w-lede h-6 rounded-sm border"></span>
        <span class="text-micro text-ink-muted font-mono">lede — 62ch</span>
        <span class="bg-interactive-surface border-interactive-border max-w-prose h-6 rounded-sm border"></span>
        <span class="text-micro text-ink-muted font-mono">prose — 70ch</span>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Tracking</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        The dimension that was missing, and the reason hand-set pages looked designed while
        token-set pages did not.
      </p>
      <div class="seam-grid grid-cols-1">
        {#each TRACKING as { cls, token, why } (token)}
          <div class="flex flex-col gap-1 p-3">
            <span class="text-body {cls}">Aa — the solar will</span>
            <span class="text-micro text-ink-muted font-mono">tracking-{token}</span>
            <span class="text-caption text-ink-muted">{why}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="rail rail-attention max-w-prose p-4">
    <p class="text-body-sm text-ink-secondary m-0">
      <strong class="text-ink-primary">The fine steps are for chrome, not content.</strong> A field
      label, a unit suffix, a column header: those are
      <code class="text-micro font-mono">micro</code>. Anything a person actually reads starts at
      <code class="text-micro font-mono">body-sm</code> and goes up. The most common way to break
      "beauty is legibility" is to keep shrinking type until a dense panel fits.
    </p>
  </div>
</section>
