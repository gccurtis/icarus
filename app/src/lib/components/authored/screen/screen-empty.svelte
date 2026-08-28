<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import * as Empty from "$lib/components/vendor/empty";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * A workspace with nothing in it, saying which nothing this is.
   *
   * **There are two, and telling them apart is the whole job.** A screen you
   * have not used yet and a filter that matched nothing look identical and are
   * completely different situations: one wants an invitation to make the first
   * thing, and the other wants its filter cleared. A single "No results" serves
   * neither — it reads as failure on a screen that has simply never been used,
   * and as emptiness on a list that is full behind a filter.
   *
   * `simple-components/empty` underneath, which is exactly what it is for.
   *
   * **`unfiltered` is a way out, not decoration.** Where a filter is what
   * emptied the screen, the way to undo that belongs here rather than back up in
   * the filter row — the reader is looking at the middle of the screen, which is
   * where the explanation is.
   */
  let {
    kind = "nothing-yet",
    title,
    icon: Icon,
    onclear,
    children
  }: {
    /** `nothing-yet` is a screen never used; `no-matches` is a filter that hid it all. */
    kind?: "nothing-yet" | "no-matches";
    title: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /** Clears the filter. Only meaningful for `no-matches`. */
    onclear?: () => void;
    /** One sentence: what to do, or what would be here. */
    children?: Snippet;
  } = $props();

  // `Empty.Root` forwards its rest props, so the marker lands on the element it renders.
  const trace = traceNode("ScreenEmpty", () => ({ kind, title }));
</script>

<Empty.Root
  {...trace}
  class="border-border-subtle bg-surface-panel rounded-panel flex-none gap-2 border border-dashed py-10"
>
  <Empty.Header class="gap-2">
    {#if Icon}
      <Empty.Media variant="icon" class="bg-surface-canvas text-ink-muted">
        <Icon aria-hidden="true" />
      </Empty.Media>
    {/if}
    <Empty.Title class="text-body-sm text-ink-primary font-medium">{title}</Empty.Title>
    {#if children}
      <Empty.Description class="text-caption text-ink-muted max-w-prose">
        {@render children()}
      </Empty.Description>
    {/if}
  </Empty.Header>
  {#if kind === "no-matches" && onclear}
    <Empty.Content>
      <button
        type="button"
        onclick={onclear}
        class="text-caption text-interactive-text cursor-pointer border-none bg-transparent p-0 hover:underline"
      >
        Clear the filter
      </button>
    </Empty.Content>
  {/if}
</Empty.Root>
