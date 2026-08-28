<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$components/development/trace.svelte";

  /**
   * Two halves and the operation between them.
   *
   * **Not two `ScreenGroup`s in a row.** Two named bands side by side are two
   * lists, and two lists is the reading the Context screen exists to prevent:
   * Include and Take out are not "things in" and "other things in", they are a
   * subtraction, and the sign between them is the only thing on the screen that
   * says so. There is no nested expression tree, on the strength of that same
   * argument — the whole model is meant to be read as arithmetic — so the
   * operator is not decoration on this layout, it is the layout's reason.
   *
   * **Not a two-track grid in the workspace's own stylesheet.** The operator has
   * to sit *between* the halves and go on sitting between them when the plane
   * narrows and they stack — an `auto` track that
   * becomes a middle row rather than a column that goes somewhere else. Getting
   * that right is one decision, and one decision made in a workspace's own CSS
   * is a decision every other screen with two related sets has to make again.
   *
   * **The operator is a symbol and a word, in one prop, so neither can arrive
   * without the other.** A minus glyph nobody can name is a decoration, and the
   * word on its own loses the arithmetic that made the screen readable. Only the
   * word is read out: the glyph is the same fact drawn, and hearing "minus
   * minus" helps no one.
   *
   * **It stacks in the order of the arithmetic, never of importance.** Left,
   * operator, right, top to bottom. A subtraction read downward is still a
   * subtraction; moving the sign out from between the halves would leave two
   * lists again at exactly the width where the screen is hardest to read.
   *
   * **The operator is not a control.** Nothing here changes the operation. What
   * relates the two halves is decided where the set is defined, not by pressing
   * the sign in the middle of it.
   */
  let {
    operator,
    left,
    right
  }: {
    /** `{ symbol: "−", word: "minus" }`. Both, always. */
    operator: { symbol: string; word: string };
    /** The first half. A `ScreenGroup`, usually. */
    left: Snippet;
    /** The second half, which the operation is applied with. */
    right: Snippet;
  } = $props();

  const trace = traceNode("ScreenSplit", () => ({ operator }));
</script>

<div {...trace} class="split">
  <div class="half-left">{@render left()}</div>

  <div class="operator">
    <!-- Drawn for the eye; the word under it is what is read out. -->
    <span class="glyph text-ink-muted" aria-hidden="true">{operator.symbol}</span>
    <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
      {operator.word}
    </span>
  </div>

  <div class="half-right">{@render right()}</div>
</div>

<style>
  /*
   * Two equal halves and one column exactly as wide as the sign. The halves
   * start at the top and the operator centres itself against them, so the sign
   * lands beside the middle of the relationship rather than above it.
   */
  .split {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 1fr auto 1fr;
    grid-template-areas: "left operator right";
    align-items: start;
  }

  .half-left {
    grid-area: left;
    min-width: 0;
  }

  .half-right {
    grid-area: right;
    min-width: 0;
  }

  .operator {
    grid-area: operator;
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .glyph {
    font-size: var(--token-text-h2);
    line-height: 1;
  }

  /*
   * One column below the width where two halves stop being readable side by
   * side. The operator becomes the middle row, because a sign that is not
   * between the two things it relates is a sign that says nothing.
   */
  @media (max-width: 60rem) {
    .split {
      grid-template-columns: 1fr;
      grid-template-areas:
        "left"
        "operator"
        "right";
      gap: calc(var(--token-spacing-unit) * 4);
    }

    .operator {
      flex-direction: row;
      gap: calc(var(--token-spacing-unit) * 2);
    }
  }
</style>
