<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const CELLS = ["Origin", "Confidence", "Reviewed", "Applied", "Source", "Run"];

  const DENSITY = [
    { cls: "h-7", token: "compact — 28px", where: "Inspector rows, dense grids, chips" },
    { cls: "h-8", token: "base — 32px", where: "Forms, toolbars, panel controls" },
    { cls: "h-10", token: "roomy — 40px", where: "Primary actions, empty states" }
  ];

  const STEPS = [
    { cls: "w-1", label: "1 — 4px" },
    { cls: "w-2", label: "2 — 8px" },
    { cls: "w-3", label: "3 — 12px" },
    { cls: "w-4", label: "4 — 16px" },
    { cls: "w-6", label: "6 — 24px" },
    { cls: "w-8", label: "8 — 32px" },
    { cls: "w-12", label: "12 — 48px" }
  ];

  const RADII = [
    { token: "control", cls: "rounded-control", what: "Buttons, inputs, chips" },
    { token: "panel", cls: "rounded-panel", what: "Panels, cards, live blocks" },
    { token: "overlay", cls: "rounded-overlay", what: "Modals, popovers, drawers" }
  ];

  const ROWS = [
    { key: "winter-brief", origin: "Prompt", confidence: "0.94", state: "Applied" },
    { key: "q3-rollup", origin: "Formula", confidence: "1.00", state: "Applied" },
    { key: "supplier-risk", origin: "Agent run", confidence: "0.71", state: "Needs review" },
    { key: "headcount", origin: "Manual", confidence: "—", state: "Stale" }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="06 · Arrangement"
    title="Seams, not boxes"
    source="styles/aesthetic/arrangement.md"
    lede="Placement is not a delivery detail for a decision made elsewhere — it is half the decision. What you show matters, and where and in what order you show it matters exactly as much."
  />

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="flex flex-col gap-2">
      <span class="eyebrow">Boxes</span>
      <div class="grid grid-cols-3 gap-3">
        {#each CELLS as cell (cell)}
          <div class="border-border-subtle rounded-panel bg-surface-elevated border p-3">
            <span class="text-body-sm">{cell}</span>
          </div>
        {/each}
      </div>
      <p class="text-caption text-ink-muted max-w-note m-0">
        Six objects. Every card carries four borders and eight corners, and every neighbour pair has
        two rules where one would do.
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <span class="eyebrow">Seams</span>
      <div class="seam-grid grid-cols-3">
        {#each CELLS as cell (cell)}
          <div class="p-3">
            <span class="text-body-sm">{cell}</span>
          </div>
        {/each}
      </div>
      <p class="text-caption text-ink-muted max-w-note m-0">
        One object with internal structure. Neighbours share a single hairline, and the outer edge
        is one border and one radius. Cheaper to hold in the head, too.
      </p>
    </div>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">The attached block</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        A rail says <em>this is joined to the flow beside it</em>; a symmetric bordered card says
        <em>this is a separate object</em>. Getting that wrong is the most common reason an
        annotated document looks like a form.
      </p>
      <div class="rail p-3">
        <p class="text-body-sm m-0">A decision, attached to the paragraph it decides about.</p>
      </div>
      <div class="rail rail-attention p-3">
        <p class="text-body-sm m-0">Human judgment required — the system deferred to a person.</p>
      </div>
      <div class="rail rail-intelligence p-3">
        <p class="text-body-sm m-0">Derived work, with its origin one step away.</p>
      </div>
      <div class="rail rail-quiet p-3">
        <p class="text-body-sm m-0">A quoted source, carrying no role of its own.</p>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Density</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        Three heights on the four-pixel grid, because a screen has three kinds of room. Within one
        region, one height — mixed heights in a row is the fastest way to make a considered panel
        look unfinished.
      </p>
      {#each DENSITY as { cls, token, where } (token)}
        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="border-border-strong bg-surface-elevated rounded-control text-label px-3 duration-micro ease-standard hover:bg-surface-panel-hover {cls}"
          >
            Inspect
          </button>
          <span class="text-micro text-ink-muted font-mono">{token}</span>
          <span class="text-caption text-ink-muted">{where}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">The grid</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        One declared unit, <code class="text-micro font-mono">0.25rem</code>, and every step is a
        multiple of it. Nothing lands off-grid.
      </p>
      <div class="flex flex-col gap-1">
        {#each STEPS as { cls, label } (cls)}
          <div class="flex items-center gap-3">
            <span class="text-micro text-ink-muted w-20 shrink-0 font-mono">{label}</span>
            <div class="bg-interactive-fill rounded-control h-3 {cls}"></div>
          </div>
        {/each}
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Curvature</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        A radius names what a thing <em>is</em>, never how important it is. Corners are where the
        formlessness of the citadel is actually spent.
      </p>
      <div class="flex flex-wrap gap-4">
        {#each RADII as { token, cls, what } (token)}
          <div class="flex flex-col items-center gap-2">
            <div class="bg-surface-panel border-border-strong size-20 border {cls}"></div>
            <span class="text-micro text-ink-muted font-mono">{token}</span>
            <span class="text-caption text-ink-muted max-w-32 text-center">{what}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <div class="flex flex-col gap-3">
    <h3 class="text-h4 font-semibold">Tables</h3>
    <p class="text-body-sm text-ink-secondary max-w-prose m-0">
      The densest distinction problem in the product, so its conventions are fixed. The header takes
      its own ground — not a heavier rule, a different plane. The first column is the key, left
      aligned, with one seam separating it from the rest. Everything after it is centred, and
      numbers use tabular figures so they compare down the column without being read.
    </p>
    <div class="table-frame">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Value</th>
            <th scope="col">Origin</th>
            <th scope="col">Confidence</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {#each ROWS as { key, origin, confidence, state } (key)}
            <tr>
              <th scope="row" class="text-ink-primary text-body-sm border-border-subtle border-r px-3 py-2 text-left font-medium">{key}</th>
              <td>{origin}</td>
              <td class="font-mono">{confidence}</td>
              <td>
                {#if state === "Applied"}
                  <span class="text-success-text text-body-sm">✓ Applied</span>
                {:else if state === "Needs review"}
                  <span class="text-attention-text text-body-sm">◆ Needs review</span>
                {:else}
                  <span class="text-attention-text text-body-sm">↻ Stale</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
