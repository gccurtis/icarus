<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const DURATIONS = [
    { token: "micro", value: "100ms", what: "Press, hover, toggle" },
    { token: "small", value: "150ms", what: "Tooltips, small transitions" },
    { token: "panel", value: "220ms", what: "Panel collapse, drawer, tab change" },
    { token: "overlay", value: "260ms", what: "Modals, popovers" },
    { token: "arrival", value: "420ms", what: "Something that happened rather than something you did" }
  ];

  let caused = $state(0);
  let happened = $state(0);
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="05 · Motion"
    title="Caused, and meaningful"
    source="styles/aesthetic/motion.md"
    lede="Motion without intent is disruption. Every movement must have a reason it happened and must tell the person something they did not already know. A thinking space is a place you can put a thought down and find it again."
  />

  <div class="surface-seam-grid grid-cols-1 lg:grid-cols-2">
    <div class="flex flex-col gap-3 p-5">
      <span class="surface-eyebrow">You did that</span>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        A person acted and the movement confirms the act landed. It should feel continuous with the
        gesture that caused it — <code class="text-micro font-mono">ease-standard</code> leaves
        quickly and arrives gently.
      </p>
      <button
        type="button"
        class="bg-interactive-fill text-ink-on-fill rounded-control h-8 w-fit px-3 text-label font-medium duration-micro ease-standard hover:bg-interactive-fill-hover"
        onclick={() => (caused += 1)}
      >
        Apply the change
      </button>
      <div class="border-border-subtle rounded-panel bg-surface-work h-24 overflow-hidden border p-2">
        {#key caused}
          <div
            class="bg-interactive-surface border-interactive-border rounded-control motion-caused border p-2"
          >
            <span class="text-body-sm">Applied — {caused} time{caused === 1 ? "" : "s"}</span>
          </div>
        {/key}
      </div>
    </div>

    <div class="flex flex-col gap-3 p-5">
      <span class="surface-eyebrow">This happened</span>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        Nobody asked for it in the moment it occurred, so the movement carries the information that
        it is new — and, often, an implicit question.
        <code class="text-micro font-mono">ease-arrival</code> enters slowly and settles long, so it
        never impersonates a response.
      </p>
      <button
        type="button"
        class="border-border-strong rounded-control h-8 w-fit border px-3 text-label font-medium duration-micro ease-standard hover:bg-surface-panel-hover"
        onclick={() => (happened += 1)}
      >
        Simulate a run finishing
      </button>
      <div class="border-border-subtle rounded-panel bg-surface-work h-24 overflow-hidden border p-2">
        {#key happened}
          <div class="bg-intelligence-surface border-intelligence-border rounded-control motion-arrived flex items-center gap-2 border p-2">
            <span class="surface-live-dot"></span>
            <span class="text-body-sm">A derived value arrived · does this need you?</span>
          </div>
        {/key}
      </div>
    </div>
  </div>

  <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div class="surface-table-frame">
      <table class="surface-data-table">
        <thead>
          <tr>
            <th scope="col">Duration</th>
            <th scope="col">Value</th>
            <th scope="col">What moves</th>
          </tr>
        </thead>
        <tbody>
          {#each DURATIONS as { token, value, what } (token)}
            <tr>
              <th scope="row" class="text-ink-primary text-body-sm border-border-subtle border-r px-3 py-2 text-left font-mono font-medium">{token}</th>
              <td class="font-mono">{value}</td>
              <td class="text-left">{what}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Things rise; they do not fly</h3>
      <p class="text-body-sm text-ink-secondary max-w-note m-0">
        Two distances, and nothing travels further under its own power. Anything needing more than
        8px is not animating, it is relocating — and relocation should be instant, so spatial memory
        stays true.
      </p>
      <div class="surface-seam-grid grid-cols-2">
        <div class="flex flex-col gap-1 p-3">
          <span class="text-body-sm font-medium">rise — 4px</span>
          <span class="text-caption text-ink-muted">Menus, tooltips, chips settling onto a plane</span>
        </div>
        <div class="flex flex-col gap-1 p-3">
          <span class="text-body-sm font-medium">drift — 8px</span>
          <span class="text-caption text-ink-muted">Drawers, panels, derived output arriving off-plane</span>
        </div>
      </div>

      <div class="surface-rail surface-rail-quiet p-4">
        <p class="text-body-sm text-ink-secondary m-0">
          Turn every transition off and this section is still correct — quieter, but correct. If a
          state is only legible because something moved, the state was never designed.
        </p>
      </div>
    </div>
  </div>
</section>

<style>
  .motion-caused {
    animation: rise var(--token-motion-panel) var(--token-ease-standard);
  }

  .motion-arrived {
    animation: drift var(--token-motion-arrival) var(--token-ease-arrival);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(var(--token-motion-rise));
    }
  }

  @keyframes drift {
    from {
      opacity: 0;
      transform: translateY(var(--token-motion-drift));
    }
  }
</style>
