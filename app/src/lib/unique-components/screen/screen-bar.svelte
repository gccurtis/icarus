<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";

  import { Button } from "$lib/simple-components/button";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * The strip that says which one of many you are editing, and how to get back.
   *
   * Six screens have a library and an editor in one tab — Templates, Personas,
   * Automations, Context, Analysis and Research. Entering the editor replaces
   * the library, and without this the tab looks like a different screen with no
   * way back. It is the whole of what "subscreen" costs the user.
   *
   * The way back is `simple-components/button`, because it is the one control on
   * the screen a person reaches for when they feel lost, and a control reached
   * for in that state has to answer with a press.
   */
  let {
    title,
    onback,
    backLabel = "Back to library",
    meta,
    actions
  }: {
    title: string;
    /** Absent when the state was not entered from a list. */
    onback?: () => void;
    backLabel?: string;
    /** Chips qualifying the thing: its kind, its saved state. */
    meta?: Snippet;
    actions?: Snippet;
  } = $props();

  const trace = traceNode("ScreenBar", () => ({ title, backLabel }));
</script>

<div
  {...trace}
  class="border-border-subtle bg-surface-panel flex h-9 shrink-0 items-center gap-2 border-b px-3"
>
  {#if onback}
    <Button variant="ghost" size="xs" onclick={onback} class="text-ink-secondary -ms-1.5">
      <ChevronLeft aria-hidden="true" />
      {backLabel}
    </Button>
  {/if}
  <span class="text-body-sm truncate font-medium">{title}</span>
  {#if meta}
    <div class="flex items-center gap-1">{@render meta()}</div>
  {/if}
  {#if actions}
    <div class="ms-auto flex items-center gap-1">{@render actions()}</div>
  {/if}
</div>
