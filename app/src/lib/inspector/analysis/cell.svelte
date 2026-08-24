<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Funnel from "@lucide/svelte/icons/funnel";
  import Layers from "@lucide/svelte/icons/layers";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelMeter,
    PanelNote,
    PanelSection,
    PanelTable
  } from "$lib/unique-components/panel";
  import {
    analysis,
    placementsOn,
    resultFor,
    rowsUnder
  } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One cell: a row and a column, and the rows that were collapsed to make it.
   *
   * **A cell is computed, so it has no properties of its own.** There is nothing
   * here to set — the value came from a placement, a filter chain and a
   * grouping — which is why the panel is a reading of it and two ways out rather
   * than a form.
   *
   * **Show as is this panel's own and says so.** A per-cell format has nowhere to
   * be stored, and a control that silently reformatted the table would be
   * claiming otherwise. What it changes is what this panel prints.
   */
  let { analysisId, rowId, columnKey }: {
    analysisId?: string;
    rowId?: string;
    columnKey?: string;
  } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const up = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const row = $derived(
    result.rows.find(
      (one) => one.id === (rowId ?? (chosen?.kind === "cell" ? chosen.id : undefined))
    ) ?? result.rows[0]
  );

  const measures = $derived(result.columns.filter((one) => one.role === "measure"));
  const group = $derived(result.columns.find((one) => one.role === "group"));

  const column = $derived(
    measures.find((one) => one.key === (columnKey ?? chosen?.at)) ?? measures[0]
  );
  const at = $derived(Math.max(0, measures.findIndex((one) => one.key === column?.key)));

  const value = $derived(row.values[at] ?? 0);

  /** The column this cell sits in, which is what a share is a share of. */
  const columnTotal = $derived(
    result.rows.reduce((sum, one) => sum + (one.values[at] ?? 0), 0)
  );

  const placement = $derived(up.find((one) => one.reads === column?.key));

  /** The source rows the cell collapsed. A second query, not a property of the result. */
  const under = $derived(rowsUnder(row.id).current);

  /* Show as. The panel's own reading of one number, not a stored format. */
  let format = $state("Number");

  const FORMATS = [
    { value: "Number", label: "Number" },
    { value: "Thousands", label: "Thousands" },
    { value: "Share", label: "Share" }
  ] as const;

  const shown = $derived(
    format === "Thousands"
      ? `${number(Math.round(value / 1000))}k`
      : format === "Share"
        ? `${columnTotal === 0 ? 0 : Math.round((value / columnTotal) * 100)}%`
        : number(value)
  );

  let pending = $state<string | undefined>(undefined);
</script>

<Panel title={shown}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: row.group },
        { label: column?.label ?? "Cell" }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label={group?.label ?? "Row"} mono>{row.group}</PanelField>
    <PanelField label="Column">{column?.label ?? "—"}</PanelField>
    <PanelField label="Value" mono>{number(value)}</PanelField>
    {#if placement}
      <PanelField label="From" mono>{placement.variable}.{placement.field}</PanelField>
      <PanelField label="How">{placement.aggregation} over the rows in this group</PanelField>
    {/if}
  </PanelFields>

  <PanelMeter
    label="Share of {column?.label ?? 'the column'}"
    detail="{columnTotal === 0 ? 0 : Math.round((value / columnTotal) * 100)}% of {number(columnTotal)}"
    value={value}
    max={columnTotal}
  />

  <PanelSection title="Show as">
    <PanelChoice
      label="Show as"
      value={format}
      options={FORMATS}
      onchange={(next: string) => (format = next)}
    />
    <PanelNote>
      This panel's reading of the number. The table still draws {number(value)}.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Underneath" count={under.total} flush>
    <PanelNote>{under.total} rows in {under.variable}</PanelNote>
    <PanelTable
      columns={under.columns}
      rows={under.rows.map((one) => one.cells)}
      total={under.total}
    />
    <PanelNote tone="gap">
      These rows are a second query rather than a property of the result. Whether they are computed
      on selection or carried in the result changes what the evaluator has to return.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="What is underneath"
        icon={Layers}
        onclick={() => view.inspect("analysis.mark", { kind: "mark", id: row.id })}
      />
      <PanelButton
        label="Filter to this"
        icon={Funnel}
        title="Keep only rows where {group?.label ?? 'the group'} is {row.group}"
        onclick={() => (pending = `Adds ${group?.key ?? "the group"} is ${row.group}.`)}
      />
      <PanelButton
        label="Exclude"
        icon={Ban}
        title="Drop rows where {group?.label ?? 'the group'} is {row.group}"
        onclick={() => (pending = `Adds ${group?.key ?? "the group"} is not ${row.group}.`)}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
    <!--
      Both act on the row, not on the cell. A rule that kept one measure of one
      group and nothing else would leave the table with a hole in it.
    -->
    <PanelNote tone="gap">
      Both narrow by the group rather than by the cell. A condition on one cell has no meaning:
      there is no stage that runs after the grouping for it to sit in.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
