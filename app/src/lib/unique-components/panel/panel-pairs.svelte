<script lang="ts">
  import type { Snippet } from "svelte";
  import Plus from "@lucide/svelte/icons/plus";

  import PanelButton from "$lib/unique-components/panel/panel-button.svelte";

  /**
   * A block of pairs the reader creates, names and fills in.
   *
   * The one shape here where the *names* are the reader's rather than the
   * model's. `PanelFields` renders pairs the schema decided — Provider, Status,
   * Last sync — and no reader can add a row to it. This is the other case:
   * project variables, connector headers, a template's inputs, a persona's
   * settings. What makes it a different component is not that the values are
   * editable but that the left column is.
   *
   * **The add control is the component's, and the rows are the caller's.** A
   * primitive cannot own a list it did not fetch, so the caller renders one
   * `PanelPair` per pair and this owns the frame, the column headings, the empty
   * state and the way to make one more. That keeps the add affordance in exactly
   * one place across every screen that has pairs.
   *
   * **The empty state is a sentence, not a blank.** A block with no rows and no
   * words is indistinguishable from one that failed to load, and the reader has
   * no way to find out which.
   */
  let {
    columns = ["Name", "Value"],
    empty = "None yet.",
    count = 0,
    addLabel = "Add",
    onadd,
    children
  }: {
    /** The two column headings. Named, because "key" is not always the word. */
    columns?: readonly [string, string];
    /** What to say when there are no pairs. */
    empty?: string;
    /**
     * How many pairs there are. A number rather than an inspection of
     * `children`, because a snippet is defined whether or not it renders
     * anything — asked "do you have children?" this answers yes while drawing
     * nothing, and the empty sentence never appears.
     */
    count?: number;
    addLabel?: string;
    /** Absent means the set is fixed, and no add control is drawn. */
    onadd?: () => void;
    /** `PanelPair`s. Empty is a legitimate state, and says so. */
    children?: Snippet;
  } = $props();
</script>

<div class="flex flex-col gap-1.5 px-3">
  <div
    class="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5"
  >
    <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      {columns[0]}
    </span>
    <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      {columns[1]}
    </span>
    <!--
      A heading for the remove column that takes up its track. `sr-only` alone
      would not: it positions absolutely, the grid loses a cell, and every row
      below shifts one column left.
    -->
    <span><span class="sr-only">Remove</span></span>

    {#if count > 0}
      {@render children?.()}
    {/if}
  </div>

  {#if count === 0}
    <p class="text-caption text-ink-muted m-0 italic">{empty}</p>
  {/if}

  {#if onadd}
    <div class="flex">
      <PanelButton label={addLabel} icon={Plus} tone="ghost" onclick={onadd} />
    </div>
  {/if}
</div>
