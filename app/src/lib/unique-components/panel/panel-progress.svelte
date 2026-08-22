<script lang="ts">
  import { Progress } from "$lib/simple-components/progress";
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * How far through something is.
   *
   * A sync, an extraction, a batch of agent tasks, an upload. Every one of these
   * has the same two failure modes and this settles both.
   *
   * **A bar with no figure is a bar nobody can act on.** "About two-thirds" is
   * not a fact anyone can plan around; "148 of 212 files" is. The figure is
   * required for that reason, and it is the caller's to phrase because only the
   * caller knows the unit.
   *
   * **Unknown is a state, not zero.** A determinate bar sitting at nothing is
   * indistinguishable from work that has not started, and both are
   * indistinguishable from work that has silently died. Omitting `value` draws
   * the indeterminate form instead, which says *running, extent unknown* — the
   * honest rendering of a job the server has not reported on.
   */
  let {
    label,
    detail,
    value,
    tone = "active"
  }: {
    /** What is progressing. Read to assistive technology. */
    label: string;
    /** The figure: "148 of 212 files", "3 of 9 tasks". Never a bare percentage. */
    detail?: string;
    /** 0–100. Absent means running with no known extent. */
    value?: number;
    tone?: "active" | "intelligence" | "attention";
  } = $props();

  const trace = traceNode("PanelProgress", () => ({ label, detail, value, tone }));

  const FILL: Record<NonNullable<typeof tone>, string> = {
    active: "[&>div]:bg-active-fill",
    intelligence: "[&>div]:bg-intelligence-fill",
    attention: "[&>div]:bg-attention-fill"
  };
</script>

<div {...trace} class="flex flex-col gap-1 px-3">
  <div class="flex items-baseline justify-between gap-2">
    <span class="text-caption text-ink-secondary truncate">{label}</span>
    {#if detail}
      <span class="text-caption text-ink-muted shrink-0 tabular-nums">{detail}</span>
    {/if}
  </div>

  {#if value === undefined}
    <!--
      Indeterminate: a sliver that travels, rather than a bar at zero. The
      difference is the whole point — one says "running", the other says
      "nothing has happened", and only one of them is true.
    -->
    <div
      role="progressbar"
      aria-label={label}
      class="bg-surface-panel h-1 w-full overflow-hidden rounded-full"
    >
      <div class={cn("h-full w-1/3 animate-pulse rounded-full", FILL[tone].slice(7, -1))}></div>
    </div>
  {:else}
    <Progress {value} aria-label={label} class={cn("h-1", FILL[tone])} />
  {/if}
</div>
