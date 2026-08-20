<script lang="ts">
  import type { Snippet } from "svelte";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import * as Alert from "$lib/simple-components/alert";
  import { cn } from "$lib/simple-components/utils";

  /**
   * A statement across the width of a screen, about the whole of what is under
   * it.
   *
   * Two uses, and they are the same shape for a reason. Editing a deck layout
   * changes every slide using it; charting two unrelated variables produces a
   * number that is quietly wrong. Both are things the surface has to say *before*
   * the work rather than after, and both would be dismissed and forgotten as a
   * toast.
   *
   * `simple-components/alert` underneath — the `role="alert"` and the icon-and-
   * text grid are the registry's, and both are easy to get subtly wrong by hand.
   * The registry's two variants are default and destructive; neither of these is
   * either, so the tones are ours over its base.
   */
  let {
    title,
    tone = "attention",
    meta,
    actions,
    children
  }: {
    title: string;
    tone?: "attention" | "intelligence";
    /** A count on the right of the title: how much depends on this. */
    meta?: string;
    actions?: Snippet;
    /** The explanation, and what to do about it. */
    children?: Snippet;
  } = $props();
</script>

<Alert.Root
  class={cn(
    "rounded-panel items-start gap-x-2 p-3",
    tone === "attention" && "border-attention-border bg-attention-surface text-attention-text",
    tone === "intelligence" &&
      "border-intelligence-border bg-intelligence-surface text-intelligence-text"
  )}
>
  <TriangleAlert aria-hidden="true" />
  <Alert.Title class="text-body-sm flex items-center justify-between gap-2 font-medium">
    <span class="min-w-0">{title}</span>
    {#if meta}
      <span class="text-caption shrink-0 tabular-nums">{meta}</span>
    {/if}
  </Alert.Title>
  {#if children}
    <Alert.Description class="text-caption text-current">
      {@render children()}
    </Alert.Description>
  {/if}
  {#if actions}
    <div class="col-start-2 flex gap-1 pt-1">{@render actions()}</div>
  {/if}
</Alert.Root>
