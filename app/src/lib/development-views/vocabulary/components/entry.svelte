<script lang="ts">
  import type { Snippet } from "svelte";

  import Commented from "$development-views/vocabulary/components/commented.svelte";
  import Stage from "$development-views/vocabulary/components/stage.svelte";

  /**
   * One word of the vocabulary: what it is, when to reach for it, when not to,
   * the markup you would write, and what it renders.
   *
   * **`instead` is the field that makes this a language rather than a list.**
   * Knowing that `PanelRow` exists is easy; knowing that a row with no action is
   * not a row, and that a label-and-value pair is `PanelField` rather than a row
   * with a subtitle, is the part that is actually learned.
   */
  let {
    name,
    use,
    instead,
    code,
    width = "panel",
    children
  }: {
    /** The component's exported name, exactly as it is imported. */
    name: string;
    /** What it is for, in one sentence. */
    use: string;
    /** What to reach for instead, and when. */
    instead?: string;
    /** The markup, as you would write it. */
    code: string;
    width?: "panel" | "screen";
    /** The rendered example. */
    children: Snippet;
  } = $props();
</script>

<Commented scope="entry" label={name}>
  <article class="flex flex-col gap-3">
    <div class="flex flex-col gap-1">
      <h3 class="text-body font-mono font-semibold">{name}</h3>
      <p class="text-body-sm text-ink-secondary m-0 max-w-[70ch]">{use}</p>
      {#if instead}
        <p class="text-caption text-ink-muted m-0 max-w-[70ch]">
          <span class="text-attention-text font-semibold">Not for</span>
          {instead}
        </p>
      {/if}
    </div>

    <div class="flex flex-wrap items-start gap-4">
      <Stage {width}>{@render children()}</Stage>
      <pre
        class="text-mono border-border-subtle bg-surface-canvas rounded-control text-ink-secondary m-0 min-w-60 flex-1 overflow-x-auto border p-3 font-mono">{code}</pre>
    </div>
  </article>
</Commented>
