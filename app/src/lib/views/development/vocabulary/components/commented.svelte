<script lang="ts">
  import type { Snippet } from "svelte";

  import CommentBox from "$views/development/vocabulary/components/comment-box.svelte";

  /**
   * One row of the page, with its note box in the gutter.
   *
   * **The gutter is a fixed column, not a fraction**, so every box on the page
   * shares one right edge however wide the content beside it is. A gutter that
   * flexed would step in and out down the page and stop reading as a column.
   */
  let {
    scope,
    label,
    children
  }: {
    scope: string;
    label: string;
    children: Snippet;
  } = $props();
</script>

<div class="grid grid-cols-[minmax(0,1fr)_17rem] items-start gap-6">
  <div class="min-w-0">{@render children()}</div>
  <CommentBox {scope} {label} />
</div>
