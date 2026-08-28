<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect,
    PanelStat,
    PanelStats
  } from "$authored-components/panel";
  import { aggregationsFor, analysis, placementsOn, resultFor } from "$capabilities/analysis";
  import type { Aggregation } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Several cells, dragged or shift-clicked across the table.
   *
   * **The figures are the point.** Selecting a block of cells is how anyone asks
   * "what do these come to", so the total is the first band rather than a
   * summary at the bottom — and it is refused when the members span columns with
   * different units, because customer-minutes and event counts do not add.
   *
   * **A subtotal per column is the honest form of that refusal.** It answers the
   * question for each unit separately instead of printing one number nobody can
   * name.
   *
   * The selection arrives as `at`: a comma-separated list of `row:column` pairs,
   * because a cell is a row and a column and neither identifies one alone.
   */
  let { analysisId, at }: { analysisId?: string; at?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const up = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const measures = $derived(result.columns.filter((one) => one.role === "measure"));
  const group = $derived(result.columns.find((one) => one.role === "group"));

  /**
   * Four cells across two columns by default, so the panel opens on the state it
   * exists for. A block that all agrees hides what the lens is here to show.
   */
  const fallback = $derived(
    [
      `${result.rows[0]?.id}:${measures[0]?.key}`,
      `${result.rows[1]?.id}:${measures[0]?.key}`,
      `${result.rows[0]?.id}:${measures[1]?.key ?? measures[0]?.key}`,
      `${result.rows[1]?.id}:${measures[1]?.key ?? measures[0]?.key}`
    ].join(",")
  );

  const members = $derived(
    (at ?? (chosen?.kind === "cells" ? chosen.at : undefined) ?? fallback)
      .split(",")
      .map((part) => {
        const [rowId, ...rest] = part.split(":");
        const key = rest.join(":");
        const row = result.rows.find((one) => one.id === rowId);
        const index = measures.findIndex((one) => one.key === key);
        const column = measures[Math.max(0, index)];
        return {
          id: part,
          rowId: row?.id ?? rowId,
          group: row?.group ?? rowId,
          key: column?.key ?? "",
          label: column?.label ?? "",
          value: row?.values[Math.max(0, index)] ?? 0
        };
      })
      .filter((member) => member.key !== "")
  );

  /* What they agree on. */
  const keys = $derived(new Set(members.map((one) => one.key)));
  const groups = $derived(new Set(members.map((one) => one.group)));

  let setColumn = $state<string | undefined>(undefined);
  const mixedColumn = $derived(setColumn === undefined && keys.size > 1);
  const column = $derived(setColumn ?? [...keys][0] ?? "");

  const placementFor = (key: string) => up.find((one) => one.reads === key);

  /* Summarise by, over what every selected cell's column permits. */
  const permitted = $derived(
    [...keys]
      .map((key) => aggregationsFor(placementFor(key)?.type ?? "number").current)
      .reduce<readonly Aggregation[]>(
        (shared, next) => shared.filter((one) => next.includes(one)),
        aggregationsFor(placementFor([...keys][0] ?? "")?.type ?? "number").current
      )
  );

  let setAggregation = $state<Aggregation | undefined>(undefined);

  const aggregations = $derived(
    new Set([...keys].map((key) => placementFor(key)?.aggregation ?? "Each value"))
  );
  const mixedAggregation = $derived(setAggregation === undefined && aggregations.size > 1);
  const aggregation = $derived(setAggregation ?? [...aggregations][0] ?? "Each value");

  const COLUMNS = $derived(measures.map((one) => ({ value: one.key, label: one.label })));
  const AGGREGATIONS = $derived(permitted.map((one) => ({ value: one, label: one })));

  /* The figures. One subtotal per column, because the units do not mix. */
  const subtotals = $derived(
    [...keys].map((key) => {
      const inColumn = members.filter((one) => one.key === key);
      const values = inColumn.map((one) => one.value);
      return {
        key,
        label: inColumn[0]?.label ?? key,
        count: values.length,
        total: values.reduce((sum, one) => sum + one, 0),
        largest: values.length === 0 ? 0 : Math.max(...values),
        smallest: values.length === 0 ? 0 : Math.min(...values)
      };
    })
  );

  const only = $derived(subtotals.length === 1 ? subtotals[0] : undefined);

  /* Show as — this panel's reading, not a stored format. */
  let format = $state("Number");

  const FORMATS = [
    { value: "Number", label: "Number" },
    { value: "Thousands", label: "Thousands" }
  ] as const;

  const shown = (value: number) =>
    format === "Thousands" ? `${number(Math.round(value / 1000))}k` : number(value);

  let pending = $state<string | undefined>(undefined);

  const listOf = (words: readonly string[]) =>
    words.length < 2
      ? (words[0] ?? "")
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

  const names = $derived(listOf([...groups]));
</script>

<Panel title="{members.length} cells">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: `${members.length} cells` }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Together">
    {#if only}
      <PanelStats label="Selection">
        <PanelStat value={shown(only.total)} label="total" />
        <PanelStat value={shown(only.largest)} label="largest" />
        <PanelStat value={shown(only.smallest)} label="smallest" />
      </PanelStats>
      <PanelNote>
        {only.count} cells in {only.label}, so they share a unit and they add.
      </PanelNote>
    {:else}
      <!-- The refusal, and the reason for it, in the band where the number would be. -->
      <PanelNote>
        These cells span {keys.size} columns with different units, so there is no one total. Each
        column's own is below.
      </PanelNote>
      <PanelFields>
        {#each subtotals as one (one.key)}
          <PanelField label={one.label} mono>{shown(one.total)} · {one.count} cells</PanelField>
        {/each}
      </PanelFields>
    {/if}
    <PanelChoice
      label="Show as"
      value={format}
      options={FORMATS}
      onchange={(next: string) => (format = next)}
    />
  </PanelSection>

  <PanelSection title="Selection" count={members.length} flush>
    {#each members as one (one.id)}
      <PanelRow
        title={one.group}
        sub={one.label}
        meta={shown(one.value)}
        onselect={() => view.inspect("analysis.mark", { kind: "mark", id: one.rowId })}
      />
    {/each}
  </PanelSection>

  <PanelSection title="In common">
    <PanelFields>
      <PanelField label={group?.label ?? "Rows"}>
        {groups.size === 1 ? [...groups][0] : `${groups.size} groups`}
      </PanelField>
      <PanelField label="Column" stacked>
        <PanelSelect
          label="Column"
          value={column}
          options={COLUMNS}
          mixed={mixedColumn}
          onchange={(next: string) => (setColumn = next)}
        />
      </PanelField>
      <PanelField label="Summarise" stacked>
        <PanelSelect
          label="Summarise by"
          value={aggregation}
          options={AGGREGATIONS}
          mixed={mixedAggregation}
          onchange={(next: string) => (setAggregation = next as Aggregation)}
        />
      </PanelField>
    </PanelFields>
    {#if mixedColumn}
      <PanelNote>
        Choosing a column here moves every selected cell into it, which is a different block of
        cells rather than an edit to this one.
      </PanelNote>
    {/if}
    {#if setColumn !== undefined || setAggregation !== undefined}
      <PanelNote>Set on all {members.length}.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Summarising is a property of the column, so setting it here changes every cell in those
      columns and not only the selected ones. Whether a selection should be able to do that at all
      is undecided.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Filter to these"
        icon={Funnel}
        title="Keep only {names}"
        onclick={() => (pending = `Adds ${group?.key ?? "the group"} is one of ${names}.`)}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      A filter narrows rows, so it acts on the {groups.size} groups these cells sit in rather than
      on the cells. There is no rule that keeps part of a row.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
