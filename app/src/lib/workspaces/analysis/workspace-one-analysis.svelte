<script lang="ts">
  import type { AnalyticSlot } from "$json-store/types/data/analytic";
  import {
    AnalyticComponent,
    analyticDisplayKind,
    customizationSlotsFor
  } from "$lib/unique-components/analytic";
  import { createChartSelection } from "$lib/unique-components/chart";
  import { PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenHeader,
    ScreenNote,
    ScreenSurface
  } from "$lib/unique-components/screen";
  import { Button } from "$lib/simple-components/button";
  import {
    analysis,
    analyticModel,
    filtersIn,
    limitIn,
    relationship,
    resultFor,
    sortIn
  } from "$mock-capabilities/analysis";
  import { viewState } from "$model/client/view-state";

  /**
   * One saved analytic, presented in the same order a person would explain it:
   * name the answer, show the answer, then expose the ordered program that made
   * it. The center is the same `AnalyticComponent` embedded by other surfaces.
   */
  let { analysisId = "an-minutes" }: { analysisId?: string } = $props();

  const view = viewState();
  const record = $derived(analysis(analysisId).current);
  const analytic = $derived(analyticModel(analysisId).current);
  const result = $derived(resultFor(analysisId).current);
  const filters = $derived(filtersIn(analysisId).current);
  const sort = $derived(sortIn(analysisId).current);
  const limit = $derived(limitIn(analysisId).current);
  const pairing = $derived(relationship(analysisId).current);
  const displayKind = $derived(analyticDisplayKind(analytic.component));
  const slots = $derived(customizationSlotsFor(displayKind));
  const chartSelection = createChartSelection();

  let active = $state<AnalyticSlot>("data");

  const labelFor = (slot: AnalyticSlot) =>
    slot === "x"
      ? "X axis"
      : slot === "y"
        ? "Y axis"
        : slot === "data"
          ? "Data"
          : slot === "labels"
            ? "Labels"
            : "Size";

  const shape = $derived(
    `Showing ${result.rows.length} of ${result.total}${limit === null ? "" : ` · limit ${limit.keep}`}`
  );

  const inspectVariable = (id: string) =>
    view.inspect("analysis.variable", { kind: "variable", id });
  const inspectPlacement = (id: string) =>
    view.inspect("analysis.placement", { kind: "placement", id });
  const inspectFilter = (id: string) =>
    view.inspect("analysis.filter", { kind: "filter", id });
</script>

<ScreenSurface wide>
  <div class="board">
    <ScreenHeader title={record.title}>
      {#snippet actions()}
        <PanelChip tone={record.state === "Saved" ? "success" : "attention"}>
          {record.state}
        </PanelChip>
        <Button variant="outline" size="sm">Duplicate</Button>
      {/snippet}
    </ScreenHeader>

    <section class="answer" aria-label="Analytic result">
      <AnalyticComponent
        {analytic}
        {chartSelection}
        height={390}
        showTitle={false}
      />
      <ScreenNote meta={shape}>
        The same identified component renders here, in a document block, on a slide, and over a
        spreadsheet. This is the last complete materialization of the editable definition below.
      </ScreenNote>
    </section>

    <section class="customizer border-border-subtle bg-surface-panel rounded-panel border">
      <nav class="slot-rail border-border-subtle" aria-label="Analytic channels">
        {#each slots as slot (slot.slot)}
          <button
            type="button"
            class:active={active === slot.slot}
            aria-pressed={active === slot.slot}
            onclick={() => (active = slot.slot)}
          >
            <span>{labelFor(slot.slot)}</span>
            <span class="text-caption">{slot.required ? "Required" : "Optional"}</span>
          </button>
        {/each}
      </nav>

      <div class="channel">
        <header class="channel-header">
          <div>
            <p class="text-caption text-ink-muted m-0">Customization</p>
            <h2 class="text-body text-ink-primary m-0 font-semibold">{labelFor(active)}</h2>
          </div>
          <PanelChip>{displayKind === "bar" ? "Stacked bar" : displayKind}</PanelChip>
        </header>

        {#if active === "x"}
          <div class="card-grid">
            <button type="button" class="source-card" onclick={() => inspectVariable("v-2")}>
              <span class="text-caption text-ink-muted">Input table</span>
              <strong class="text-body-sm text-ink-primary">substations</strong>
              <span class="text-caption text-ink-secondary">Column · name</span>
              <code>$substations["name"]</code>
            </button>

            <div class="drop-card">
              <span class="text-caption text-ink-muted">Add another list</span>
              <strong class="text-body-sm text-ink-secondary">Drop a variable here</strong>
              <span class="text-caption text-ink-muted">Then choose Extend or Join.</span>
            </div>
          </div>
        {:else if active === "y"}
          <div class="empty-channel">
            <strong class="text-body-sm text-ink-primary">No Y list</strong>
            <span class="text-caption text-ink-muted">
              Optional for this bar. Add a second categorical list when the analytic needs another
              aligned dimension.
            </span>
          </div>
        {:else if active === "labels"}
          <div class="empty-channel">
            <strong class="text-body-sm text-ink-primary">No custom label list</strong>
            <span class="text-caption text-ink-muted">
              Value labels are currently a chart-format choice. Drop a list here to materialize a
              different label for every datum.
            </span>
          </div>
        {:else if active === "size"}
          <div class="empty-channel">
            <strong class="text-body-sm text-ink-primary">No size list</strong>
            <span class="text-caption text-ink-muted">
              Drop a non-negative list here when a bubble or another size-aware output needs an
              independent magnitude channel.
            </span>
          </div>
        {:else if active === "data"}
          <div class="data-program">
            <button
              type="button"
              class="relation-card"
              onclick={() => view.inspect("analysis.relationship")}
            >
              <span class="text-caption text-ink-muted">Data relation · outer join</span>
              <strong class="text-body-sm text-ink-primary">
                substations.id = outageEvents.subId
              </strong>
              <span class="text-caption text-ink-secondary">
                {pairing.key.matched} of {pairing.key.of} source keys currently match · unmatched
                records remain null
              </span>
            </button>

            <ol class="operations" aria-label="Ordered data operations">
              {#each filters as filter, index (filter.id)}
                <li>
                  <span class="step">{index + 1}</span>
                  <button type="button" onclick={() => inspectFilter(filter.id)}>
                    <span class="text-caption text-ink-muted">Filter</span>
                    <strong class="text-body-sm text-ink-primary">{filter.reads}</strong>
                    <span class="text-caption text-ink-secondary">
                      {filter.rowsKept.toLocaleString()} of {filter.rowsIn.toLocaleString()} kept
                    </span>
                  </button>
                </li>
              {/each}
              <li>
                <span class="step">{filters.length + 1}</span>
                <button type="button" onclick={() => inspectPlacement("p-x1")}>
                  <span class="text-caption text-ink-muted">Group</span>
                  <strong class="text-body-sm text-ink-primary">substations.name</strong>
                  <span class="text-caption text-ink-secondary">One group per substation</span>
                </button>
              </li>
              <li>
                <span class="step">{filters.length + 2}</span>
                <button type="button" onclick={() => inspectPlacement("p-y1")}>
                  <span class="text-caption text-ink-muted">Aggregate</span>
                  <strong class="text-body-sm text-ink-primary">Sum customerMinutes</strong>
                  <span class="text-caption text-ink-secondary">As Customer-minutes</span>
                </button>
              </li>
              {#if sort !== null}
                <li>
                  <span class="step">{filters.length + 3}</span>
                  <button type="button" onclick={() => view.inspect("analysis.sort")}>
                    <span class="text-caption text-ink-muted">Sort</span>
                    <strong class="text-body-sm text-ink-primary">{sort.reads}</strong>
                    <span class="text-caption text-ink-secondary">{sort.direction}</span>
                  </button>
                </li>
              {/if}
              {#if limit !== null}
                <li>
                  <span class="step">{filters.length + (sort === null ? 3 : 4)}</span>
                  <button type="button" onclick={() => view.inspect("analysis.limit")}>
                    <span class="text-caption text-ink-muted">Limit</span>
                    <strong class="text-body-sm text-ink-primary">Keep {limit.keep}</strong>
                    <span class="text-caption text-ink-secondary">of {limit.of} groups</span>
                  </button>
                </li>
              {/if}
            </ol>
          </div>
        {/if}
      </div>
    </section>
  </div>
</ScreenSurface>

<style>
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
  }

  .answer {
    display: grid;
    min-width: 0;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .customizer {
    display: grid;
    min-width: 0;
    min-height: calc(var(--token-spacing-unit) * 64);
    grid-template-columns: minmax(8.5rem, 0.22fr) minmax(0, 1fr);
    overflow: hidden;
  }

  .slot-rail {
    display: flex;
    flex-direction: column;
    padding: calc(var(--token-spacing-unit) * 2);
    border-inline-end: 1px solid var(--token-border-subtle);
    background: var(--token-surface-elevated);
  }

  .slot-rail button {
    display: flex;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2.5);
    color: var(--token-ink-secondary);
    text-align: start;
    background: transparent;
    border: 0;
    border-radius: var(--token-radius-control);
    cursor: pointer;
  }

  .slot-rail button:hover {
    background: var(--token-surface-panel-hover);
  }

  .slot-rail button.active {
    color: var(--token-color-active-text);
    background: var(--token-color-active-surface);
    outline: 1px solid var(--token-color-active-border);
  }

  .channel {
    display: grid;
    min-width: 0;
    align-content: start;
    gap: calc(var(--token-spacing-unit) * 4);
    padding: calc(var(--token-spacing-unit) * 4);
  }

  .channel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .source-card,
  .drop-card,
  .empty-channel,
  .relation-card {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--token-spacing-unit);
    padding: calc(var(--token-spacing-unit) * 3);
    text-align: start;
    background: var(--token-surface-panel);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
  }

  button.source-card,
  button.relation-card {
    cursor: pointer;
  }

  button.source-card:hover,
  button.relation-card:hover,
  .operations button:hover {
    background: var(--token-surface-panel-hover);
  }

  .drop-card,
  .empty-channel {
    justify-content: center;
    min-height: calc(var(--token-spacing-unit) * 24);
    border-style: dashed;
  }

  code {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .data-program {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .relation-card {
    width: 100%;
  }

  .operations {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .operations li {
    display: grid;
    grid-template-columns: 1.75rem minmax(0, 1fr);
    align-items: stretch;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .operations .step {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    align-self: center;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    border: 1px solid var(--token-border-subtle);
    border-radius: 999px;
    place-items: center;
  }

  .operations button {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(5rem, 0.22fr) minmax(10rem, 1fr) minmax(8rem, auto);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2.5) calc(var(--token-spacing-unit) * 3);
    text-align: start;
    background: var(--token-surface-panel);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    cursor: pointer;
  }

  @media (max-width: 48rem) {
    .customizer {
      grid-template-columns: 1fr;
    }

    .slot-rail {
      flex-direction: row;
      overflow-x: auto;
      border-inline-end: 0;
      border-bottom: 1px solid var(--token-border-subtle);
    }

    .operations button {
      grid-template-columns: 1fr;
    }
  }
</style>
