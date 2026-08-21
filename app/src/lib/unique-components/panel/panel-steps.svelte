<script lang="ts">
  import type { Component } from "svelte";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleSlash from "@lucide/svelte/icons/circle-slash";
  import CircleX from "@lucide/svelte/icons/circle-x";
  import Clock from "@lucide/svelte/icons/clock";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";

  import { cn } from "$lib/simple-components/utils";

  /**
   * A plan, and what has become of each step in it.
   *
   * An agent task's plan, an import's stages, a rule's dispatch. Prospective:
   * this is what is meant to happen, and the states say how far that intention
   * has got.
   *
   * **Not `PanelTimeline`.** A timeline is what happened; a plan is what is
   * meant to happen. Drawn alike they read alike, and a reader cannot tell a
   * step that failed from an event that occurred — so this one has no rail, and
   * every line carries a state instead.
   *
   * **Not `PanelProgress`.** Three of five steps done is not sixty per cent of
   * anything: the fourth may take an hour. A bar answers "how far"; the question
   * a plan is asked is "which one is stuck", and only the steps answer it.
   *
   * **A state is a word and a mark, and the five words are fixed.** Icon and
   * word and colour are decided here once rather than per caller — a list of
   * `PanelRow`s with a tick and a tone would leave the mapping from *failed* to
   * a shape and a name to be re-made on every surface that draws a plan, and a
   * plan reading "Failed" on one screen and "Errored" on the next has given the
   * reader two vocabularies for one situation.
   *
   * **No numbers on the steps.** A number claims strict sequence, and an
   * import's stages or an agent's plan often have two of them underway at once.
   * The order is the list's; the states say which are moving.
   */

  type StepState = "done" | "running" | "waiting" | "failed" | "skipped";

  type Step = {
    /** Stable across refreshes: this is the each block's key. */
    id: string;
    /** What the step is meant to do. */
    label: string;
    /** Why it is where it is: what is running, what failed, what it is waiting on. */
    detail?: string;
    /** A duration or a count, at the end of the second line. Never a control. */
    meta?: string;
    state: StepState;
    /** Opens the step. Absent where a step is not a thing you can go to. */
    onselect?: () => void;
  };

  let {
    steps,
    label,
    flush = false
  }: {
    /** In the plan's own order. */
    readonly steps: readonly Step[];
    /**
     * What the plan is for. The list's accessible name.
     *
     * Not drawn — a visible heading over a plan is `PanelSection`'s.
     */
    label: string;
    /** Drop the panel gutter, for a plan inside an already-padded region. */
    flush?: boolean;
  } = $props();

  /**
   * The whole component, in a table. A state is its word, its shape and its
   * role colour together, and the three are never separable: the word survives
   * a reader who cannot tell the colours apart, and the shape survives a glance
   * too quick to read.
   */
  const STATE: Record<
    StepState,
    {
      word: string;
      icon: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
      tone: string;
    }
  > = {
    done: { word: "Done", icon: CircleCheck, tone: "text-success-text" },
    running: { word: "Running", icon: LoaderCircle, tone: "text-active-text" },
    waiting: { word: "Waiting", icon: Clock, tone: "text-ink-muted" },
    failed: { word: "Failed", icon: CircleX, tone: "text-danger-text" },
    skipped: { word: "Skipped", icon: CircleSlash, tone: "text-inactive-text" }
  };
</script>

<ol aria-label={label} class={cn("m-0 flex list-none flex-col p-0", flush ? "px-0" : "px-3")}>
  {#each steps as step (step.id)}
    {@const state = STATE[step.state]}
    {@const Icon = state.icon}
    <li class="flex min-h-6 items-start gap-2 py-1">
      <!--
        The turning ring is the one state that is also a claim about right now,
        so it is drawn moving. The word beside it says the same thing standing
        still, for a reader whose motion is reduced or whose glance is not on it.
      -->
      <span
        class={cn(
          "mt-0.5 flex shrink-0",
          state.tone,
          step.state === "running" && "motion-safe:animate-spin"
        )}
      >
        <Icon size={14} aria-hidden="true" />
      </span>

      <span class="flex min-w-0 flex-1 flex-col">
        <span class="flex items-baseline justify-between gap-2">
          {#if step.onselect}
            <button
              type="button"
              onclick={step.onselect}
              title={step.label}
              class="text-body-sm text-ink-primary min-w-0 flex-1 truncate text-start hover:underline"
            >
              {step.label}
            </button>
          {:else}
            <span title={step.label} class="text-body-sm text-ink-primary min-w-0 flex-1 truncate">
              {step.label}
            </span>
          {/if}
          <span class={cn("text-caption shrink-0", state.tone)}>{state.word}</span>
        </span>

        {#if step.detail || step.meta}
          <span class="flex items-baseline justify-between gap-2">
            <span title={step.detail} class="text-caption text-ink-muted min-w-0 flex-1 truncate">
              {step.detail ?? ""}
            </span>
            {#if step.meta}
              <span class="text-caption text-ink-muted shrink-0 tabular-nums">{step.meta}</span>
            {/if}
          </span>
        {/if}
      </span>
    </li>
  {/each}
</ol>
