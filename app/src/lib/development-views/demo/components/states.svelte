<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const STATES = [
    { name: "Idle", cue: "Neutral boundary, no fill", cls: "border-border-subtle text-ink-primary" },
    {
      name: "Hover",
      cue: "A border or ground shift only. Never a change in size or position",
      cls: "border-border-strong text-ink-primary"
    },
    {
      name: "Focus",
      cue: "A 2px interactive outline at 2px offset. Always visible, never suppressed",
      cls: "border-interactive-border text-ink-primary"
    },
    {
      name: "Selected",
      cue: "Persistent, and distinguishable from hover with colour removed",
      cls: "border-active-border bg-active-surface text-active-text"
    },
    {
      name: "Active",
      cue: "Momentary feedback at micro",
      cls: "border-interactive-border bg-interactive-surface text-interactive-text"
    },
    {
      name: "Disabled",
      cue: "Reduced contrast plus a reason. Never a silently dead control",
      cls: "border-border-subtle text-inactive-text"
    },
    {
      name: "Pending",
      cue: "Copy naming the queue position or wait. No motion",
      cls: "border-border-subtle text-ink-secondary"
    },
    {
      name: "Resolving",
      cue: "Progress plus copy naming the current stage",
      cls: "border-active-border text-active-text"
    },
    {
      name: "Applied",
      cue: "Icon plus copy. Reversible, or it says why not",
      cls: "border-success-border text-success-text"
    },
    {
      name: "Failed",
      cue: "Icon, copy, and a recovery action. Never an accusation",
      cls: "border-danger-border text-danger-text"
    },
    {
      name: "Needs review",
      cue: "A handoff, not an error. The system did its part",
      cls: "border-attention-border text-attention-text"
    },
    {
      name: "Stale",
      cue: "Names what changed, keeps the last known value, offers a refresh",
      cls: "border-attention-border text-attention-text"
    },
    {
      name: "Untraceable",
      cue: "The origin could not be established, so the value is not shown",
      cls: "border-border-strong text-ink-muted"
    }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="07 · States"
    title="What a component must be able to say"
    source="styles/aesthetic/states.md"
    lede="A component is an instrument, and instruments are judged on whether they report their condition honestly. Remove colour from this section and every row is still readable — that is the requirement, not a nicety."
  />

  <div class="seam-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
    {#each STATES as { name, cue, cls }, index (name)}
      <div
        class="flex flex-col gap-1 p-4 {index === STATES.length - 1
          ? 'sm:col-span-2 lg:col-span-3'
          : ''}"
      >
        <span class="rounded-control text-label w-fit border px-2 py-1 font-semibold {cls}">
          {name}
        </span>
        <span class="text-caption text-ink-muted max-w-note">{cue}</span>
      </div>
    {/each}
  </div>

  <div class="grid gap-5 lg:grid-cols-2">
    <div class="rail rail-quiet p-4">
      <p class="text-body-sm text-ink-secondary m-0">
        <strong class="text-ink-primary">This is a floor, not a cage.</strong> A screen that
        genuinely needs a condition this list does not name should express it, well — and then the
        list should grow. What is not negotiable is honesty: every state pairs its colour with copy,
        an icon, a boundary, or a position.
      </p>
    </div>
    <div class="rail rail-attention p-4">
      <p class="text-body-sm text-ink-secondary m-0">
        <strong class="text-ink-primary">Untraceable is not low confidence.</strong> A derived value
        whose origin the system cannot establish is an answer the system does not have. It says so
        rather than displaying the value with a caveat.
      </p>
    </div>
  </div>
</section>
