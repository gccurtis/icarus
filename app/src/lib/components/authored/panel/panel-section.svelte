<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";

  import * as Collapsible from "$lib/components/vendor/collapsible";
  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * One disclosure inside a panel: a heading, a count, and what it holds.
   *
   * Sections are how a panel says more than fits. Which ones start open is a
   * disclosure decision made per view — the rule the specifications keep is that
   * what you came for is open and what qualifies it is shut.
   *
   * The disclosure is `bits-ui`'s rather than a hand-rolled `aria-expanded`,
   * so the trigger, the region and their relationship come from one
   * implementation that has already been tested against a screen reader.
   *
   * **`flush` is about rows, not about taste.** A section holding list rows lets
   * them run to the panel's edges, because a row is a target and an inset target
   * with a hover fill looks like a card. A section holding prose or fields keeps
   * the panel's padding.
   */
  let {
    title,
    count,
    open = true,
    flush = false,
    children
  }: {
    title: string;
    /**
     * How many things are in here. Absent when a count would say nothing.
     *
     * A string when the section is showing fewer than it has — `"3 of 4,182"`,
     * `"of 96"` — which is the same matched-of-total rule `PanelSearchSection`
     * and `ScreenFilters` keep. A section that samples its contents and reports
     * a bare number claims the sample is the whole.
     */
    count?: number | string;
    /** Whether it starts disclosed. */
    open?: boolean;
    /** Let the body run edge to edge, for a section of rows. */
    flush?: boolean;
    children: Snippet;
  } = $props();

  // The marker is forwarded through `Collapsible.Root` onto the element it renders.
  const trace = traceNode("PanelSection", () => ({ title, count, open, flush }));

  /**
   * `open` is the starting disclosure and nothing after that. Reading it once is
   * the intent: a section the user has shut must not spring open because its
   * caller re-rendered.
   */
  // svelte-ignore state_referenced_locally
  let expanded = $state(open);
</script>

<Collapsible.Root {...trace} bind:open={expanded} class="flex flex-col">
  <Collapsible.Trigger
    class="text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 px-3 py-1.5 text-start"
  >
    <ChevronDown
      size={13}
      aria-hidden="true"
      class={cn("transition-transform duration-150", !expanded && "-rotate-90")}
    />
    <span class="text-caption font-semibold tracking-wide uppercase">{title}</span>
    {#if count !== undefined}
      <span class="text-caption text-ink-muted ms-auto tabular-nums">{count}</span>
    {/if}
  </Collapsible.Trigger>

  <Collapsible.Content class={cn("flex flex-col gap-1.5 pb-2", flush ? "px-0" : "px-3")}>
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>
