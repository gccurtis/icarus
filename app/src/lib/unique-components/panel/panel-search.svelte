<script lang="ts">
  import type { Snippet } from "svelte";

  import { Input } from "$lib/simple-components/input";
  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A filter, and the things it filters, as one component.
   *
   * **It contains what it searches, and that is the whole design.** This used to
   * be a bare field that `Panel` pinned under the title, which left "what does
   * it filter?" unanswerable from any one place: the frame rendered the field
   * and knew nothing of the content, and each caller filtered its own sections
   * with no structure saying so. The scope was a convention, and a convention
   * that a reader has to reconstruct from two files is a scope nobody can check.
   *
   * Here the answer is the markup. What is inside is what is searched.
   *
   * **The groups go inside it.** The panels that wanted this are each one list
   * grouped by kind — Resources by kind of resource, People by kind of actor,
   * Variables by tables/values/functions — so the sections are the list's
   * presentation rather than separate subjects.
   *
   * **It counts, rather than being handed a count.** `matched` and `total` are
   * numbers because the rule they enforce is not optional: a filtered list
   * showing a bare number claims the filtered set is the whole set. Handing this
   * a preformatted string made that the caller's discipline; handing it two
   * numbers makes it impossible to get wrong.
   *
   * **Nothing matching is a state this owns.** It is the one outcome a filter
   * has that its caller cannot draw better — an empty result renders as an empty
   * panel, indistinguishable from one that failed to load — so the sentence
   * lives here and every filter in the application says it the same way.
   */
  let {
    placeholder,
    title,
    matched,
    total,
    empty = "Nothing matches.",
    flush = false,
    value = $bindable(""),
    children
  }: {
    /** Says what will be searched, so the field never sits there unlabelled. */
    placeholder: string;
    /** The list's own name. Omit it when the panel's title already says it. */
    title?: string;
    /** How many are showing. With `total`, rendered as "6 of 41". */
    matched?: number;
    /** How many there are in all. Never rendered on its own. */
    total?: number;
    /**
     * What to say when nothing matched. A sentence rather than a blank, because
     * an empty panel and a panel that failed are the same picture.
     */
    empty?: string;
    /** Let the body run edge to edge, for a list of rows rather than sections. */
    flush?: boolean;
    value?: string;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelSearch", () => ({
    placeholder,
    title,
    matched,
    total,
    empty,
    flush,
    value
  }));

  const count = $derived(
    matched !== undefined && total !== undefined ? `${matched} of ${total}` : undefined
  );

  /** Only a `matched` of exactly zero is empty; not knowing is not the same as none. */
  const nothing = $derived(matched === 0);
</script>

<section {...trace} class="flex flex-col">
  {#if title || count}
    <div class="flex items-center gap-1.5 px-3 pt-1.5">
      {#if title}
        <span class="text-caption text-ink-secondary font-semibold tracking-wide uppercase">
          {title}
        </span>
      {/if}
      {#if count}
        <span class="text-caption text-ink-muted ms-auto tabular-nums">{count}</span>
      {/if}
    </div>
  {/if}

  <div class="px-3 py-1.5">
    <Input
      type="search"
      bind:value
      {placeholder}
      aria-label={placeholder}
      class="text-body-sm h-7 [&::-webkit-search-cancel-button]:hidden"
    />
  </div>

  {#if nothing}
    <p class="text-caption text-ink-muted m-0 px-3 py-1 italic" role="status">{empty}</p>
  {:else}
    <div class={cn("flex flex-col", flush ? "px-0" : "gap-1.5 px-3")}>
      {@render children()}
    </div>
  {/if}
</section>
