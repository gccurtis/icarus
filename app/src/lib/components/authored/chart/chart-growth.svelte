<script lang="ts">
  import { asPercent, cagr, elementOverElement } from "$components/authored/chart/growth";
  import { cn } from "$lib/components/vendor/utils";

  /**
   * The change between one element and the next, over the chart it belongs to.
   *
   * **A strip rather than annotations inside the plot.** Arrows drawn between
   * bar tops are what a presentation tool does, and they are right there,
   * because the chart is going on a slide and will be read once from ten feet
   * away. Here the chart is read next to its own table, repeatedly, and a row of
   * figures on the same band positions is easier to scan down and does not have
   * to be redrawn every time the data changes shape. The alignment is the same
   * either way: one column per category, in order.
   *
   * **It only makes sense along the category axis**, so it is only drawn for
   * vertical charts. A horizontal bar chart would want this down the side, which
   * is a different component rather than this one rotated.
   *
   * **A figure that cannot be computed is a dash, never a zero.** No previous
   * element, or a previous element of zero, gives no percentage — and printing
   * 0% there would claim the quantity held steady when what actually happened is
   * that there was nothing to compare it to.
   */
  let {
    labels,
    values,
    showCagr = true
  }: {
    /** The categories, in the order the chart draws them. */
    labels: readonly string[];
    /** One figure per category — usually the stack's total. */
    values: readonly number[];
    showCagr?: boolean;
  } = $props();

  const steps = $derived(elementOverElement(values, labels));
  const compound = $derived(cagr(values));
</script>

<div class="flex flex-col gap-1">
  <div class="flex" role="row" aria-label="Change from the previous element">
    {#each steps as step (step.label)}
      <div class="flex flex-1 justify-center px-1">
        <span
          class={cn(
            "text-caption tabular-nums",
            step.change === undefined && "text-ink-muted",
            step.change !== undefined && step.change > 0 && "text-success-text",
            step.change !== undefined && step.change < 0 && "text-danger-text"
          )}
          title={`${step.label} against the element before it`}
        >
          {asPercent(step.change)}
        </span>
      </div>
    {/each}
  </div>

  {#if showCagr}
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-caption text-ink-muted">Change per element, compounded</span>
      <span class="text-caption text-ink-secondary tabular-nums">
        {asPercent(compound, 1)}
        {#if compound === undefined}
          <span class="text-ink-muted">— not defined for these values</span>
        {/if}
      </span>
    </div>
  {/if}
</div>
