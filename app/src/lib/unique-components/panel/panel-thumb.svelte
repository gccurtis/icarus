<script lang="ts">
  import type { Snippet } from "svelte";
  import EyeOff from "@lucide/svelte/icons/eye-off";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A preview that IS the thing's identity, because the thing has no name.
   *
   * A slide has no persisted name. Neither does a layout or a page, which is why
   * the specifications say a section list of them "cannot be read as text" and
   * ask for thumbnails instead. Every other word in this vocabulary identifies
   * something by a string — `PanelRow` is typed `title: string` — so none of them
   * can hold one of these.
   *
   * **What sits under it is an index or a role, never a title.** "4", "Title and
   * body", "Section header". Inventing a name for a thing that has none is how a
   * list of slides becomes a list of lies.
   *
   * **A state the picture cannot show is drawn on it**, not left to the caption.
   * A hidden slide looks exactly like a visible one, and the whole point of a
   * thumbnail panel is that it is read by looking.
   *
   * **The placeholder is deliberately abstract.** Bars, not a drawn document —
   * a panel must never imply a renderer it does not have, and the three editor
   * frameworks are not installed. Pass `children` once a real render exists.
   */
  let {
    ratio = "16 / 9",
    caption,
    meta,
    lines = 3,
    selected = false,
    hidden = false,
    onselect,
    children
  }: {
    /** `16 / 9` for a slide, `4 / 3` for a page, `1 / 1` for a grid. */
    ratio?: string;
    /** The index or the role. Never an invented title. */
    caption?: string;
    /** A qualifier at the caption's end: "inherited", "2 comments". */
    meta?: string;
    /** How many bars the placeholder draws. Ignored once `children` is given. */
    lines?: number;
    /** Whether this is the one the editor is on. */
    selected?: boolean;
    /** Drawn on the picture, because a caption cannot be seen at a glance. */
    hidden?: boolean;
    onselect?: () => void;
    /** A real render, once there is one. */
    children?: Snippet;
  } = $props();

  // Two roots, but only ever one of them: the marker goes on both branches.
  const trace = traceNode("PanelThumb", () => ({
    ratio,
    caption,
    meta,
    lines,
    selected,
    hidden
  }));

  const frame = $derived(
    cn(
      "rounded-control flex w-full flex-col gap-1 border p-1 text-start",
      selected ? "border-active-border bg-active-surface" : "border-border-subtle bg-surface-panel",
      onselect && "hover:border-interactive-border cursor-pointer"
    )
  );
</script>

{#snippet body()}
  <span class="relative block w-full">
    {#if children}
      {@render children()}
    {:else}
      <span
        class="border-border-subtle bg-surface-canvas rounded-control flex w-full flex-col justify-center gap-1 border p-2"
        style="aspect-ratio: {ratio}"
        aria-hidden="true"
      >
        {#each Array.from({ length: lines }) as _, index (index)}
          <span
            class="bg-border-strong h-0.5 rounded-full"
            style="width: {[70, 90, 55, 80, 65, 85][index % 6]}%"
          ></span>
        {/each}
      </span>
    {/if}
    {#if hidden}
      <span
        class="bg-surface-canvas/80 text-ink-muted absolute inset-0 flex items-center justify-center rounded-control"
        title="Hidden"
      >
        <EyeOff size={14} aria-hidden="true" />
      </span>
    {/if}
  </span>

  {#if caption || meta}
    <span class="flex items-baseline justify-between gap-1 px-0.5">
      {#if caption}
        <span
          class={cn("text-caption truncate", selected ? "text-active-text" : "text-ink-secondary")}
        >
          {caption}
        </span>
      {/if}
      {#if meta}
        <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
      {/if}
    </span>
  {/if}
{/snippet}

<!--
  Branched rather than a computed tag: a preview that opens nothing must not be
  a button, and Svelte can only check the accessibility of a tag it can see.
-->
{#if onselect}
  <button
    {...trace}
    type="button"
    onclick={onselect}
    aria-current={selected ? "true" : undefined}
    aria-label={hidden && caption ? `${caption} — hidden` : caption}
    class={frame}
  >
    {@render body()}
  </button>
{:else}
  <div {...trace} class={frame}>{@render body()}</div>
{/if}
