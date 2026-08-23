<script lang="ts">
  import type {
    AnalyticModel,
    AnalyticTableSelectionTarget
  } from "$json-store/types/data/analytic";
  import AnalyticTableRenderer from "$lib/unique-components/analytic/analytic-table-renderer.svelte";
  import { analyticIssues } from "$lib/unique-components/analytic/analytic-model";
  import ChartRenderer from "$lib/unique-components/chart/chart-renderer.svelte";
  import {
    createChartSelection,
    type ChartSelection
  } from "$lib/unique-components/chart/chart-selection.svelte";

  const localChartSelection = createChartSelection();

  let {
    analytic,
    chartSelection = localChartSelection,
    tableSelection,
    height = 300,
    showTitle = true,
    ontableselect,
    ref = $bindable(null)
  }: {
    analytic: AnalyticModel;
    chartSelection?: ChartSelection;
    tableSelection?: AnalyticTableSelectionTarget;
    height?: number;
    showTitle?: boolean;
    ontableselect?: (target: AnalyticTableSelectionTarget) => void;
    ref?: SVGSVGElement | null;
  } = $props();

  const issues = $derived(analyticIssues(analytic));
  const componentIssue = $derived(
    issues.find((entry) => entry.severity === "error" && entry.path.startsWith("component."))
  );
  const status = $derived(
    analytic.materialization.state === "ready" && issues.length === 0
      ? undefined
      : analytic.materialization.state === "ready"
        ? `${issues.length} definition ${issues.length === 1 ? "issue" : "issues"}`
        : `${analytic.materialization.state} · ${Math.max(issues.length, analytic.materialization.issueIds.length)} ${Math.max(issues.length, analytic.materialization.issueIds.length) === 1 ? "issue" : "issues"}`
  );
  const contentHeight = $derived(Math.max(1, height - (showTitle ? 32 : 0) - (status ? 28 : 0)));
</script>

<section
  class="analytic-component bg-surface-panel"
  style:height={`${height}px`}
  aria-label={analytic.title}
  data-analytic-id={analytic.id}
>
  {#if showTitle}
    <header class="text-body-sm text-ink-primary truncate font-semibold">{analytic.title}</header>
  {/if}

  <div class="output">
    {#if componentIssue}
      <div class="text-caption text-danger-text grid h-full place-items-center p-4 text-center">
        Analytic cannot render: {componentIssue.message}
      </div>
    {:else if analytic.component.kind === "chart"}
      <ChartRenderer
        chart={analytic.component.chart}
        selection={chartSelection}
        height={contentHeight}
        showTitle={false}
        bind:ref
      />
    {:else}
      <AnalyticTableRenderer
        analyticId={analytic.id}
        table={analytic.component.table}
        height={contentHeight}
        selected={tableSelection}
        onselect={ontableselect}
      />
    {/if}
  </div>

  {#if status}
    <footer class="text-caption text-ink-muted border-border-subtle border-t px-2 py-1">
      Showing the last materialized result · {status}
    </footer>
  {/if}
</section>

<style>
  .analytic-component {
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
  }

  header {
    min-width: 0;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  .output {
    min-width: 0;
    min-height: 0;
  }
</style>
