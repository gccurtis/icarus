<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A named band of the plane: a label, what it holds, and nothing else.
   *
   * Twelve of these sit across six workspace files. Without a word for a named
   * region each one copies `PanelSection`'s trigger typography — `text-caption
   * font-semibold tracking-wide uppercase` — onto the plane, and callers
   * reaching into a panel component's internal class string is the loudest
   * possible evidence that the screen family needs the word.
   *
   * **It never collapses, and that is the decision.** Disclosure is a 300px
   * problem: a panel hides sections because it has no room, and a plane has
   * room. A collapsible band on the workspace would let a screen hide half of
   * itself with no way to know it had.
   *
   * **The label is a caption in caps, never a heading**, so it cannot compete
   * with `ScreenHeader`'s title. A screen has one title; it has as many bands as
   * it needs.
   *
   * **`tone` is for when the label is itself the argument.** The Context screen
   * has an Include band and a Take out band, and the screen is a subtraction —
   * the two halves have to be told apart before either is read. Everywhere else
   * the default is right, and a toned band that carries no such argument is a
   * decoration.
   */
  let {
    label,
    tone = "default",
    count,
    actions,
    children
  }: {
    label: string;
    tone?: "default" | "success" | "danger" | "attention" | "intelligence";
    /** How many are in here. Matched-of-total when the band is filtered. */
    count?: string;
    /** Controls acting on this band alone, at its far end. */
    actions?: Snippet;
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenGroup", () => ({ label, tone, count }));

  const TONE: Record<NonNullable<typeof tone>, string> = {
    default: "text-ink-muted",
    success: "text-success-text",
    danger: "text-danger-text",
    attention: "text-attention-text",
    intelligence: "text-intelligence-text"
  };
</script>

<section {...trace} class="flex min-w-0 flex-col gap-2">
  <div class="flex flex-wrap items-center gap-2">
    <span class={cn("text-caption font-semibold tracking-wide uppercase", TONE[tone])}>
      {label}
    </span>
    {#if count}
      <span class="text-caption text-ink-muted tabular-nums">{count}</span>
    {/if}
    {#if actions}
      <div class="ms-auto flex items-center gap-1">{@render actions()}</div>
    {/if}
  </div>
  {@render children()}
</section>
