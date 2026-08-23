<script lang="ts">
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    ScreenAction,
    ScreenCard,
    ScreenCards,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenNote,
    ScreenSurface,
    ScreenThumb
  } from "$lib/unique-components/screen";
  import { ToggleGroup, ToggleGroupItem } from "$lib/simple-components/toggle-group";
  import { lastRunOf } from "$mock-capabilities/analysis";
  import { analyses, type AnalysisRow } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Analysis — all analyses: the library of every chart built on this project's
   * variables.
   *
   * `docs/screen-panel-views/screens/analysis/workspace-all-analyses.md` is the
   * specification. Four bands down one column, and the band that matters is
   * given two rows of the five: identity, then what narrows the list, then the
   * analyses themselves at twice the height of anything else, then the one line
   * that qualifies all of them.
   *
   * **Cards, not rows.** A chart is a shape, and a thumbnail of its shape
   * identifies it faster than its title does — which is the same reason
   * Templates and Personas are card grids and the work table is not.
   *
   * **The row count describes the last materialization.** `lastRunOf` is the
   * door, and it answers the same figures for every analysis here because the
   * mock holds one result. A production card can render a bounded thumbnail
   * from the saved component without replaying every analytic plan.
   */
  let {
    /** Enter the one-analysis state. Only a parent knows where that lives. */
    onopen = () => {}
  }: { onopen?: (analysisId: string) => void } = $props();

  const all = $derived(analyses().current);

  let search = $state("");
  /** `All` · `Charts` · `Tables` — the display-kind filter the specification names. */
  let display = $state("all");

  const shown = $derived(
    all
      .filter((row: AnalysisRow) =>
        display === "all"
          ? true
          : display === "tables"
            ? row.chart === "Table"
            : row.chart !== "Table"
      )
      .filter((row: AnalysisRow) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  /** The card's icon is its display kind, so the shape and the word agree. */
  const CHART_ICON = {
    Bar: ChartColumn,
    Line: ChartLine,
    Area: ChartArea,
    Table: TableIcon
  } as const;

  const open = (row: AnalysisRow) => {
    onopen(row.id);
    view.inspect("analysis.analysis", { kind: "analysis", id: row.id });
  };
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Analysis"
        about="Every chart built on this project's variables. One Analysis tab — which one you are on is view state."
      >
        {#snippet actions()}
          <ScreenAction label="New analysis" icon={ChartColumn} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search analyses"
        matched={shown.length}
        total={all.length}
        bind:value={search}
      >
        <ToggleGroup type="single" bind:value={display} variant="outline" size="sm">
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="charts">Charts</ToggleGroupItem>
          <ToggleGroupItem value="tables">Tables</ToggleGroupItem>
        </ToggleGroup>
      </ScreenFilters>
    </div>

    <div class="area-analyses">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No analysis matches"
          icon={ChartColumn}
          onclear={() => {
            search = "";
            display = "all";
          }}
        >
          Nothing in this project has that in its name, or draws itself that way.
        </ScreenEmpty>
      {:else}
        <ScreenCards>
          {#each shown as row (row.id)}
            {@const run = lastRunOf(row.id).current}
            <ScreenCard
              title={row.name}
              sub="{row.chart} · {run.rows} of {run.of} rows"
              icon={CHART_ICON[row.chart]}
              selected={view.selection?.id === row.id}
              onselect={() => open(row)}
            >
              {#snippet thumb()}
                <!--
                  A placeholder shape rather than a rendered one. The
                  full component renderer belongs in the one-analysis screen;
                  the library can derive a bounded thumbnail from the last
                  complete materialization without executing the definition.
                -->
                <ScreenThumb ratio="16 / 9" lines={4} />
              {/snippet}
              <span class="text-caption text-ink-muted tabular-nums">Ran {row.ran}</span>
            </ScreenCard>
          {/each}
        </ScreenCards>
      {/if}
    </div>

    <div class="area-note">
      <ScreenNote>
        Each card can use the last complete materialized component. Opening one also checks the
        current variables and marks that component stale while a newer result is evaluated.
      </ScreenNote>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The layout table from the specification, as `grid-template-areas`. One
   * track, because a library of shapes wants its full width for the grid of
   * them — the card grid does its own responding inside this single column.
   *
   * `analyses` is written twice because the table writes it twice: it is the
   * band the screen exists for, and it takes two rows to the one each of the
   * others gets. The rows are proportional rather than fixed — the surface
   * scrolls, so a band's share is set by how many rows it spans and by what is
   * in it.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "analyses"
      "analyses"
      "note";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-analyses {
    grid-area: analyses;
  }
  .area-note {
    grid-area: note;
  }

  /*
   * There is no one-column fallback to write: the specification's table has a
   * single track, so this grid is already the narrow form. What has to respond
   * is the card grid inside `analyses`, and `ScreenCards` owns that.
   */
</style>
