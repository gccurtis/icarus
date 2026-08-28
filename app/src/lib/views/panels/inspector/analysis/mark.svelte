<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Funnel from "@lucide/svelte/icons/funnel";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { analysis, chartFor, mark, rowsUnder } from "$capabilities/analysis";
  import type { ChartKindId } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One mark on the chart: what it stands for, and the rows underneath it.
   *
   * `docs/screen-panel-views/inspector/analysis/mark.md` is the specification.
   * This is the way from the picture back to the data, and it is what makes a
   * chart investigable rather than decorative.
   *
   * **The band is named for the kind of mark it is.** A bar, a point and a slice
   * are the same selection wearing three shapes, and a panel that calls all three
   * "this bar" is wrong two times in three.
   *
   * **Filter to this and Exclude are stated before they are taken.** Both mutate
   * the definition from a click on the picture, which is the right gesture and
   * one that has to be undoable in a single step — so the panel says what the
   * click adds rather than adding it silently.
   */
  let { markId = "m-1", analysisId = "r-minutes" }: { markId?: string; analysisId?: string } =
    $props();

  const view = viewState();

  const record = $derived(analysis(analysisId).current);
  const one = $derived(mark(markId).current);
  const under = $derived(rowsUnder(markId).current);
  const display = $derived(chartFor(analysisId).current);

  const NOUN: Record<ChartKindId, string> = {
    table: "row",
    bar: "bar",
    line: "point",
    area: "point",
    scatter: "point",
    pie: "slice"
  };
  const noun = $derived(NOUN[display.kind]);

  /** The first encoded value is the group: it is what the mark stands for. */
  const stands = $derived(one.values[0]);

  let added = $state<"keep" | "exclude" | undefined>(undefined);
  const pending = $derived(
    added === undefined
      ? undefined
      : added === "keep"
        ? `Adds ${stands.placement} is ${stands.value}.`
        : `Adds ${stands.placement} is not ${stands.value}.`
  );

  /** First cell names the row; the last is the measure that put it in this mark. */
  const detail = (row: (typeof under.rows)[number]) => row.cells.slice(1, -1).join(" · ");
  const measure = (row: (typeof under.rows)[number]) => row.cells[row.cells.length - 1];
</script>

<Panel title={stands.value}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: stands.value }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!-- Every encoded value, named by the placement that put it there. -->
  <PanelSection title="This {noun}">
    <PanelFields>
      {#each one.values as encoded (encoded.placement)}
        <PanelField label={encoded.placement} mono>{encoded.value}</PanelField>
      {/each}
    </PanelFields>
  </PanelSection>

  <PanelSection title="Underneath" count={under.total} flush>
    <PanelNote>{under.total} rows in {under.variable}</PanelNote>
    <!--
      The rows do not open anything. A source row has no lens of its own here,
      and a row that looks clickable and is not is worse than one that does not.
    -->
    {#each under.rows as row (row.id)}
      <PanelRow title={row.cells[0]} sub={detail(row)} meta={measure(row)} />
    {/each}
    <PanelNote tone="gap">
      These rows are a second query rather than a property of the result. Whether they are computed
      on selection or carried in the result changes what the evaluator has to return.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Filter to this"
        icon={Funnel}
        title="Keep only rows where {stands.placement} is {stands.value}"
        onclick={() => (added = "keep")}
      />
      <PanelButton
        label="Exclude"
        icon={Ban}
        title="Drop rows where {stands.placement} is {stands.value}"
        onclick={() => (added = "exclude")}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Both change the definition from a click on the picture. That is the right gesture, and it
      needs to be undoable in one step.
    </PanelNote>
  </PanelSection>
</Panel>
