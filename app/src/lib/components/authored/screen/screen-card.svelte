<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * One card: a shape, a name, and what qualifies it.
   *
   * The thumbnail is the point. A template, a chart, a layout and a slide are
   * recognised by their shape, and a card whose thumbnail is decoration would be
   * a list row wasting three times the space.
   */
  let {
    title,
    sub,
    icon: Icon,
    selected = false,
    href,
    onselect,
    thumb,
    children
  }: {
    title: string;
    /** Kind, scope, size — whatever tells two similar cards apart. */
    sub?: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    selected?: boolean;
    /**
     * Where it goes, when it goes somewhere.
     *
     * A card that navigates is an anchor, not a button — otherwise middle-click,
     * open-in-new-tab, copy-link and the status bar preview all quietly stop
     * working, and a card is exactly the kind of thing people open in a new tab.
     * `onselect` stays for the far commoner case where a card selects rather
     * than navigates, and the two are mutually exclusive by construction.
     */
    href?: string;
    onselect?: () => void;
    /** The shape. A `ScreenThumb`, or anything that draws one. */
    thumb?: Snippet;
    /** Extra content under the subtitle: chips, a count. */
    children?: Snippet;
  } = $props();

  // Three exclusive roots — anchor, button or div — so every arm carries the marker.
  const trace = traceNode("ScreenCard", () => ({ title, sub, selected, href }));

  const shell = $derived(
    cn(
      "border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-1.5 border p-3 text-start no-underline",
      (onselect || href) &&
        "hover:border-interactive-border hover:bg-surface-panel-hover cursor-pointer",
      selected && "border-active-border bg-active-surface"
    )
  );
</script>

{#snippet body()}
  {#if thumb}
    {@render thumb()}
  {/if}
  <span class="flex items-center gap-1.5">
    {#if Icon}
      <span class="text-ink-muted flex shrink-0"><Icon size={14} aria-hidden="true" /></span>
    {/if}
    <span class="text-body-sm text-ink-primary truncate font-medium">{title}</span>
  </span>
  {#if sub}
    <span class="text-caption text-ink-muted">{sub}</span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
{/snippet}

<!--
  Branched rather than a `<svelte:element>` with a computed tag: a card that does
  nothing must not be a button, and Svelte can only check the accessibility of a
  tag it can see. The body is a snippet so the two arms cannot drift.
-->
{#if href}
  <a {...trace} {href} aria-current={selected ? "true" : undefined} class={shell}>
    {@render body()}
  </a>
{:else if onselect}
  <button
    {...trace}
    type="button"
    onclick={onselect}
    aria-current={selected ? "true" : undefined}
    class={shell}
  >
    {@render body()}
  </button>
{:else}
  <div {...trace} class={shell}>{@render body()}</div>
{/if}
