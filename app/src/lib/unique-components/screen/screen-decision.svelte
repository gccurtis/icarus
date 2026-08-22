<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * Something offered for a decision, with the decision on it.
   *
   * `ScreenCard` becomes a button the moment it is selectable, and a button
   * cannot hold three more buttons — so Accept, Edit and Dismiss had nowhere to
   * go on a proposed finding. Selecting the card and deciding it are two
   * different acts and both have to be reachable.
   *
   * So the card is a region, its body is the one selectable thing inside it, and
   * the controls sit in a row of their own along the bottom.
   *
   * **The tone is the state and the state is a word.** A proposal that has been
   * accepted or dismissed does not vanish — it stays where it was, saying what
   * happened to it, because a row that disappeared on Accept would leave a reader
   * unable to check what they just did. Colour is never the only cue: `verdict`
   * is rendered as text beside it.
   *
   * **The controls do not disappear when a decision is made**, they change. A
   * dismissed finding can be accepted after all, which is the whole reason the
   * card is still on screen.
   */
  let {
    title,
    meta,
    verdict,
    selected = false,
    onselect,
    children,
    actions
  }: {
    title: string;
    /** Where it came from, how long ago. The right-hand end of the head. */
    meta?: string;
    /**
     * What has been decided, if anything. Rendered as a word — never as colour
     * alone, and never as an icon on its own.
     */
    verdict?: { label: string; tone: "accepted" | "dismissed" | "pending" };
    selected?: boolean;
    onselect?: () => void;
    /** The proposal itself. */
    children: Snippet;
    /** The controls that decide it. */
    actions?: Snippet;
  } = $props();

  const trace = traceNode("ScreenDecision", () => ({ title, meta, verdict, selected }));

  const VERDICT = {
    accepted: "text-success-text border-success-border bg-success-surface",
    dismissed: "text-inactive-text border-inactive-border bg-inactive-surface",
    pending: "text-attention-text border-attention-border bg-attention-surface"
  } as const;
</script>

<article
  {...trace}
  class={cn(
    "border-border-subtle rounded-panel bg-surface-panel flex flex-col border",
    selected && "border-active-border ring-active-border/40 ring-1"
  )}
>
  <header class="flex items-start gap-2 px-3 pt-2.5">
    <h3 class="text-body-sm text-ink-primary m-0 min-w-0 flex-1 font-medium">
      {#if onselect}
        <button type="button" onclick={onselect} class="w-full truncate text-start hover:underline">
          {title}
        </button>
      {:else}
        <span class="block truncate">{title}</span>
      {/if}
    </h3>

    {#if verdict}
      <span
        class={cn(
          "text-caption rounded-control shrink-0 border px-1.5 py-0.5",
          VERDICT[verdict.tone]
        )}
      >
        {verdict.label}
      </span>
    {/if}

    {#if meta}
      <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
    {/if}
  </header>

  <div class="text-body-sm text-ink-secondary px-3 py-2">
    {@render children()}
  </div>

  {#if actions}
    <!--
      A row of its own along the bottom, because the body above it is the
      selectable thing and a control inside a target is a control that fires it
      too.
    -->
    <footer class="border-border-subtle flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
      {@render actions()}
    </footer>
  {/if}
</article>
