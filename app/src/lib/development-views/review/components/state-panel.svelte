<script lang="ts">
  import ValueEditor from "$development-views/review/components/value-editor.svelte";
  import type { Review } from "$development-views/review/shared/create-review.svelte";

  /**
   * What the panel on the stage turned out to be a function of.
   *
   * Not a list of everything reachable — a list of what THIS panel actually
   * read, in the order it read it, because that is the question a reviewer has:
   * change this, and what moves?
   *
   * It is collapsed by default. An answer is often forty rows of JSON, and a
   * page that opens with all of them showing is a page whose panel is off the
   * bottom of the screen.
   */
  let {
    review,
    onchange
  }: {
    review: Review;
    onchange: () => void;
  } = $props();

  let open = $state<string | undefined>(undefined);

  const reads = $derived(review.reads);
  const overridden = $derived(review.overriddenCount);

  /** One answer, one line, so a closed row still says something. */
  const summarise = (value: unknown): string => {
    if (Array.isArray(value)) return `${value.length} row${value.length === 1 ? "" : "s"}`;
    if (value === null || value === undefined) return "—";
    if (typeof value === "object") return Object.keys(value).join(" · ");
    return String(value);
  };
</script>

<section class="flex flex-col gap-1">
  <header class="flex items-baseline gap-3">
    <h2 class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      A function of
    </h2>
    <span class="text-caption text-ink-muted tabular-nums">
      {reads.length} read{reads.length === 1 ? "" : "s"}
    </span>
    {#if overridden > 0}
      <button
        type="button"
        class="text-caption text-attention-text hover:underline"
        onclick={() => {
          review.clearOverrides();
          onchange();
        }}
      >
        {overridden} overridden — reset all
      </button>
    {/if}
  </header>

  {#if reads.length === 0}
    <p class="text-caption text-ink-muted m-0">
      This one reads nothing. Everything it shows is either a prop or its own state.
    </p>
  {:else}
    <div class="border-border-subtle divide-border-subtle rounded-panel divide-y border">
      {#each reads as read (read.id)}
        <div class="flex flex-col">
          <button
            type="button"
            class="hover:bg-surface-panel-hover flex items-baseline gap-3 px-2 py-1 text-start"
            onclick={() => (open = open === read.id ? undefined : read.id)}
          >
            <span class="text-body-sm text-ink-primary font-mono">{read.id}</span>
            <span class="text-caption text-ink-muted flex-1 truncate">{summarise(read.value)}</span>
            {#if read.overridden}
              <span class="text-caption text-attention-text">overridden</span>
            {/if}
            <span class="text-caption text-ink-muted">{open === read.id ? "−" : "+"}</span>
          </button>

          {#if open === read.id}
            <div class="px-2 pb-2">
              <ValueEditor
                {review}
                id={read.id}
                value={read.value}
                overridden={read.overridden}
                {onchange}
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
