<script lang="ts">
  import Minus from "@lucide/svelte/icons/minus";
  import Plus from "@lucide/svelte/icons/plus";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * Two versions of one piece of text, with what changed marked.
   *
   * A comment anchor whose text has moved under it, a stale value, an edit that
   * conflicts, a resource that has drifted from its template.
   *
   * **Not two `PanelField`s.** Two labelled values set near each other invite
   * the reader to compare them character by character, and that comparison is
   * the work this exists to do for them. So it is done here: the two strings are
   * compared word by word, and the words that differ are the only ones marked.
   *
   * **Not `PanelQuote`.** A quote is content from somewhere else, shown as it
   * is. A diff is a claim about two things — that they are versions of one
   * another, and that this is what happened between them — and the marks are
   * that claim.
   *
   * **The marks are `<del>` and `<ins>`.** Struck through and underlined in the
   * danger and success roles: the change survives a reader who cannot separate
   * the two colours, and it is announced to one who cannot see either. Colour is
   * the third channel here and never the first.
   *
   * **The sides are named for what they are, not for when they were.** "As
   * written" and "Now reads" — a reader can map those onto their own situation,
   * where "Before" and "After" leave them working out whose before it was.
   */
  let {
    before,
    after,
    beforeLabel = "As written",
    afterLabel = "Now reads",
    layout = "stacked",
    mono = false,
    flush = false
  }: {
    /** The older text: what the reader wrote, what the template says. */
    before: string;
    /** The newer text: what it says now. */
    after: string;
    /** Name the older side for this situation: "In the template", "You wrote". */
    beforeLabel?: string;
    /** Name the newer side: "The resource has", "It now reads". */
    afterLabel?: string;
    /**
     * Stacked by default. A 300px column split in two is 130px a side, which is
     * not a width a sentence can be read at; `side` is for values short enough
     * to take it — a number, a date, a name.
     */
    layout?: "stacked" | "side";
    /** Set both sides in mono, for values you would retype. `PanelField`'s rule. */
    mono?: boolean;
    /** Drop the panel gutter, for a diff inside an already-padded region. */
    flush?: boolean;
  } = $props();

  const trace = traceNode("PanelDiff", () => ({
    before,
    after,
    beforeLabel,
    afterLabel,
    layout,
    mono,
    flush
  }));

  /**
   * Words, and the runs of space between them kept as pieces of their own. The
   * spaces are what let a marked word end where the word ends: dropping them
   * would put the strike through the gap after it as well, which claims a change
   * to text that is not there.
   *
   * Whitespace still collapses when it is drawn, the way any prose in a panel
   * does. A value whose shape is part of it wants `PanelCode`, not this.
   */
  const split = (text: string): readonly string[] =>
    text.split(/(\s+)/).filter((piece) => piece !== "");

  /**
   * The comparison is quadratic in the two word counts. Past this it stops and
   * marks both sides whole — which is true, if coarse — rather than spending a
   * frame on a passage nobody is reading in a 300px column anyway.
   */
  const LIMIT = 20_000;

  /**
   * Longest common subsequence over words: the pieces that survive are the ones
   * left unmarked. Word by word rather than character by character, because a
   * mark inside a word is a mark the reader has to squint at, and the claim
   * being made is about what the text says, not about its letters.
   */
  function compare(
    older: readonly string[],
    newer: readonly string[]
  ): { removed: readonly boolean[]; added: readonly boolean[] } {
    const removed = older.map(() => true);
    const added = newer.map(() => true);
    if (older.length * newer.length > LIMIT) return { removed, added };

    const common: number[][] = Array.from(
      { length: older.length + 1 },
      () => new Array<number>(newer.length + 1).fill(0)
    );
    for (let i = older.length - 1; i >= 0; i -= 1) {
      for (let j = newer.length - 1; j >= 0; j -= 1) {
        common[i][j] =
          older[i] === newer[j]
            ? common[i + 1][j + 1] + 1
            : Math.max(common[i + 1][j], common[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    while (i < older.length && j < newer.length) {
      if (older[i] === newer[j]) {
        removed[i] = false;
        added[j] = false;
        i += 1;
        j += 1;
      } else if (common[i + 1][j] >= common[i][j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return { removed, added };
  }

  const olderPieces = $derived(split(before));
  const newerPieces = $derived(split(after));
  const marked = $derived(compare(olderPieces, newerPieces));

  const TEXT = $derived(
    cn(
      "text-ink-secondary m-0 min-w-0",
      mono ? "font-mono text-mono tabular-nums" : "text-body-sm"
    )
  );
</script>

{#snippet side(
  heading: string,
  pieces: readonly string[],
  changed: readonly boolean[],
  kind: "removed" | "added"
)}
  <div
    class="border-border-subtle bg-surface-canvas rounded-control flex min-w-0 flex-col gap-1 border p-2"
  >
    <!--
      The sign, then the words. Neither side is given a tinted box: tinting the
      whole of one would say the whole of it changed, which is the claim the
      marks inside it exist to make precisely.
    -->
    <span class="text-caption text-ink-muted flex items-center gap-1">
      <span
        class={cn("flex shrink-0", kind === "removed" ? "text-danger-text" : "text-success-text")}
      >
        {#if kind === "removed"}
          <Minus size={12} aria-hidden="true" />
        {:else}
          <Plus size={12} aria-hidden="true" />
        {/if}
      </span>
      {heading}
    </span>

    <p class={TEXT}>
      {#if pieces.length === 0}
        <span class="text-ink-muted">Nothing</span>
      {:else}
        {#each pieces as piece, index (index)}
          {#if changed[index]}
            {#if kind === "removed"}
              <del class="text-danger-text bg-danger-surface rounded-control px-0.5 line-through"
                >{piece}</del
              >
            {:else}
              <ins class="text-success-text bg-success-surface rounded-control px-0.5 underline"
                >{piece}</ins
              >
            {/if}
          {:else}{piece}{/if}
        {/each}
      {/if}
    </p>
  </div>
{/snippet}

<div
  {...trace}
  class={cn(
    "gap-2",
    layout === "side" ? "grid grid-cols-2 items-start" : "flex flex-col",
    flush ? "px-0" : "px-3"
  )}
>
  {@render side(beforeLabel, olderPieces, marked.removed, "removed")}
  {@render side(afterLabel, newerPieces, marked.added, "added")}
</div>
