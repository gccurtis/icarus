<script lang="ts">
  import SectionHeading from "$lib/demo/section-heading.svelte";

  /**
   * docs/frontend-contracts/interaction/component.md → State matrix.
   * Every row pairs its color with copy, so the whole set stays readable with
   * color removed. Every class names a slot, never an intensity.
   */
  const STATES = [
    { name: "Idle", cue: "Neutral boundary, no fill", cls: "border-border-subtle text-ink-primary" },
    {
      name: "Hover",
      cue: "Border or background shift only",
      cls: "border-border-strong text-ink-primary",
    },
    {
      name: "Focus",
      cue: "2px interactive ring, 2px offset",
      cls: "border-interactive-border text-ink-primary",
    },
    {
      name: "Selected",
      cue: "Persistent, distinguishable without color",
      cls: "border-active-border bg-active-surface text-active-text",
    },
    {
      name: "Disabled",
      cue: "Reduced contrast plus a reason",
      cls: "border-border-subtle text-inactive-text",
    },
    {
      name: "Pending",
      cue: "Copy naming the wait. No motion",
      cls: "border-border-subtle text-ink-secondary",
    },
    {
      name: "Resolving",
      cue: "Progress plus current stage",
      cls: "border-active-border text-active-text",
    },
    { name: "Applied", cue: "Icon plus copy", cls: "border-success-border text-success-text" },
    {
      name: "Failed",
      cue: "Icon, copy, and a recovery action",
      cls: "border-danger-border text-danger-text",
    },
    {
      name: "Needs review",
      cue: "An explicit review affordance",
      cls: "border-attention-border text-attention-text",
    },
    {
      name: "Stale",
      cue: "Names what changed, offers refresh",
      cls: "border-attention-border text-attention-text",
    },
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="State matrix" source="system/interaction/component.md" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Every state names itself. Remove color from this section and each row is still readable — that is
    the requirement, not a nicety.
  </p>
  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {#each STATES as { name, cue, cls } (name)}
      <div class="rounded-panel flex flex-col gap-1 border p-3 {cls}">
        <span class="text-label font-semibold">{name}</span>
        <span class="text-caption text-ink-muted">{cue}</span>
      </div>
    {/each}
  </div>
</section>
