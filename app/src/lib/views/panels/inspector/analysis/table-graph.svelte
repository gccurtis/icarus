<script lang="ts">
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelStat,
    PanelStats,
    PanelSelect,
    PanelTable,
    PanelToggle
  } from "$authored-components/panel";
  import {
    analysis,
    chartFor,
    chartKinds,
    lastRunOf,
    limitIn,
    placementsOn,
    resultFor,
    sortIn
  } from "$capabilities/analysis";
  import type { SortRule } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * The table as a whole: what it holds, how much of it, and in what order.
   *
   * **A table makes no encoding decisions, which is what this lens is for.** A
   * bar chart's panel is full of questions about how a number becomes a height;
   * a table's is about shape — which columns, how many rows, what order — so
   * those are the bands, and there is no colour band at all.
   *
   * **Rows and order are the same band.** A limit without a sort keeps an
   * arbitrary ten, and separating the two lets a reader set one and never see the
   * other.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const display = $derived(chartFor(id).current);
  const kinds = $derived(chartKinds().current);
  const result = $derived(resultFor(id).current);
  const run = $derived(lastRunOf(id).current);
  const order = $derived(sortIn(id).current);
  const cap = $derived(limitIn(id).current);
  const across = $derived(placementsOn(id, "x").current);
  const up = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const needs = $derived(kinds.find((one) => one.id === "table")?.needs ?? "");

  const placements = $derived([...across, ...up]);

  /** A column is keyed by the placement that produced it, which is how a column opens one. */
  const placementFor = (key: string) => placements.find((one) => one.reads === key);

  /* Order. */
  const TARGETS = $derived(placements.map((one) => ({ value: one.id, label: one.reads })));

  let retargeted = $state<string | undefined>(undefined);
  let reversed = $state<SortRule["direction"] | undefined>(undefined);
  let rekept = $state<string | undefined>(undefined);

  const target = $derived(retargeted ?? order?.placementId ?? TARGETS[0]?.value ?? "");
  const direction = $derived(reversed ?? order?.direction ?? "High to low");
  const reads = $derived(TARGETS.find((one) => one.value === target)?.label ?? "");
  const keep = $derived(rekept ?? (cap === null ? "" : String(cap.keep)));

  const DIRECTIONS = [
    { value: "Low to high", label: "Low to high" },
    { value: "High to low", label: "High to low" }
  ] as const;

  /**
   * The order and the limit are applied here rather than described, because the
   * rows they act on are on screen directly above the controls. A band that
   * named an order the table below it did not follow would be the one reading a
   * reader cannot check.
   */
  const orderedAt = $derived(
    result.columns.filter((column) => column.role === "measure").findIndex((column) => column.key === reads)
  );
  const orders = $derived(result.columns.some((column) => column.key === reads));

  const ordered = $derived.by(() => {
    const rows = [...result.rows];
    if (!orders) return rows;
    const sign = direction === "High to low" ? -1 : 1;
    return rows.sort((left, right) =>
      orderedAt < 0
        ? sign * left.group.localeCompare(right.group)
        : sign * ((left.values[orderedAt] ?? 0) - (right.values[orderedAt] ?? 0))
    );
  });

  /** An empty field is no limit rather than a limit of nothing. */
  const kept = $derived(Number.parseInt(keep, 10));
  const limited = $derived(Number.isNaN(kept) || kept < 1 ? ordered : ordered.slice(0, kept));

  /** The same prefix the Variables lens shows for a table value: a header, three rows, a total. */
  const preview = $derived(
    limited.slice(0, 3).map((row) => [row.group, ...row.values.map(number)])
  );

  /* Drawing. None of these is a persisted property; the gap note says so. */
  let headerRow = $state(true);
  let bandedRows = $state(false);
  let totalsRow = $state(false);
</script>

<Panel title="Table">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Table" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Chart settings"
      icon={SquareArrowOutUpRight}
      onclick={() => view.inspect("analysis.chart", { kind: "analysis", id })}
    />
  {/snippet}

  <PanelStats label="Shape">
    <PanelStat value={number(result.columns.length)} label="columns" />
    <PanelStat value={number(result.rows.length)} label="rows drawn" />
    <PanelStat value={number(result.total)} label="groups in all" />
  </PanelStats>

  <PanelFields>
    <PanelField label="Title">{display.title}</PanelField>
    <PanelField label="Evaluated">{run.ran} · {run.duration}</PanelField>
  </PanelFields>

  <PanelSection title="Contents" count="{limited.length} of {number(result.total)}">
    <PanelTable
      columns={result.columns.map((column) => column.label)}
      rows={preview}
      total={limited.length}
      unit="rows"
    />
    <PanelNote>{needs}</PanelNote>
  </PanelSection>

  <!-- A column is a placement wearing a heading, so each row opens the placement. -->
  <PanelSection title="Columns" count={result.columns.length} flush>
    {#each result.columns as column (column.key)}
      <PanelRow
        title={column.label}
        sub={column.key}
        meta={column.role === "group" ? "Group" : "Measure"}
        onselect={() => {
          const placed = placementFor(column.key);
          if (placed) view.inspect("analysis.placement", { kind: "placement", id: placed.id });
        }}
      />
    {/each}
    <PanelNote>
      The group column names each row; the measures are what was counted under it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Rows">
    <PanelFields>
      <PanelField label="Keep">
        top
        <PanelEditableText
          label="How many rows to keep"
          value={keep}
          mono
          placeholder="All"
          onchange={(next: string) => (rekept = next)}
        />
      </PanelField>
      <PanelField label="Of" mono>{number(result.total)} groups</PanelField>
      <PanelField label="Order by" stacked>
        <PanelSelect
          label="Order by"
          value={target}
          options={TARGETS}
          onchange={(next: string) => (retargeted = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelChoice
      label="Direction"
      value={direction}
      options={DIRECTIONS}
      onchange={(next: string) => (reversed = next as SortRule["direction"])}
    />
    {#if orders}
      <PanelNote>Ordered by {reads}, {direction.toLowerCase()}.</PanelNote>
    {:else}
      <PanelNote>Nothing orders the rows, so which of them survive the limit is arbitrary.</PanelNote>
    {/if}
    {#if limited.length < ordered.length}
      <PanelNote>
        Keeping the top {limited.length} of {ordered.length} drawn, out of {number(result.total)}
        groups in all.
      </PanelNote>
    {/if}
    <PanelActions>
      <PanelButton
        label="Sort"
        onclick={() => view.inspect("analysis.sort", { kind: "analysis", id })}
      />
      <PanelButton
        label="Limit"
        onclick={() => view.inspect("analysis.limit", { kind: "analysis", id })}
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Drawing" open={false}>
    <PanelToggle
      label="Header row"
      checked={headerRow}
      onchange={(next: boolean) => (headerRow = next)}
    />
    <PanelToggle
      label="Banded rows"
      checked={bandedRows}
      onchange={(next: boolean) => (bandedRows = next)}
    />
    <PanelToggle
      label="Totals row"
      checked={totalsRow}
      onchange={(next: boolean) => (totalsRow = next)}
    />
    <PanelNote tone="gap">
      None of these three is a property a chart can hold. A totals row is the one that also needs
      an answer from the evaluator — a sum of sums is not always the sum.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
