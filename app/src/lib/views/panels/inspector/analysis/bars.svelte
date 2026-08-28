<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Funnel from "@lucide/svelte/icons/funnel";
  import Layers from "@lucide/svelte/icons/layers";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelMeter,
    PanelNote,
    PanelSection,
    PanelSelect,
    PanelSwatch,
    PanelSwatches
  } from "$components/authored/panel";
  import { analysis, chartFor, placementsOn, resultFor } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One bar: what it is drawn as, and what it stands for.
   *
   * **`analysis.mark` answers what is underneath a bar; this answers what the bar
   * is.** Two questions, and one panel that tried to be both would open on three
   * source rows when the reader clicked a colour they did not recognise. The way
   * from here to there is a button rather than a merge.
   *
   * **A bar is a group and a series, never a group alone.** Two measures make two
   * bars over the same substation, and a lens that named only the substation
   * would be identical for both while describing one.
   *
   * **The share is beside the value because a bar is read against its neighbours.**
   * 1,842,000 says nothing on its own; a third of everything drawn says what the
   * eye is already claiming.
   */
  let { analysisId, rowId }: { analysisId?: string; rowId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const display = $derived(chartFor(id).current);
  const result = $derived(resultFor(id).current);
  const series = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const measures = $derived(result.columns.filter((column) => column.role === "measure"));

  /** The bar the chart was clicked on: a row for the group, a measure for the series. */
  const row = $derived(
    result.rows.find((one) => one.id === (rowId ?? (chosen?.kind === "bar" ? chosen.id : undefined))) ??
      result.rows[0]
  );

  let chosenSeries = $state<string | undefined>(undefined);
  const measureKey = $derived(
    measures.find((one) => one.key === (chosenSeries ?? chosen?.at))?.key ?? measures[0]?.key ?? ""
  );
  const index = $derived(Math.max(0, measures.findIndex((one) => one.key === measureKey)));
  const measure = $derived(measures[index]);

  const value = $derived(row.values[index] ?? 0);

  /** Everything drawn in this series, which is what a bar's height is being compared with. */
  const drawn = $derived(result.rows.map((one) => one.values[index] ?? 0));
  const total = $derived(drawn.reduce((sum, one) => sum + one, 0));
  const tallest = $derived(drawn.length === 0 ? 0 : Math.max(...drawn));
  const rank = $derived(
    [...drawn].sort((left, right) => right - left).indexOf(value) + 1
  );

  const share = $derived(total === 0 ? 0 : Math.round((value / total) * 100));

  const MEASURES = $derived(measures.map((one) => ({ value: one.key, label: one.label })));

  /* Drawing. */
  const colourOf = (at: number) => display.colours[at % display.colours.length];

  let recoloured = $state<string | undefined>(undefined);
  let relabelled = $state<string | undefined>(undefined);

  const colour = $derived(
    display.colours.find((one) => one.id === recoloured) ?? colourOf(index)
  );
  const label = $derived(relabelled ?? row.group);

  const COLOURS = $derived(display.colours.map((one) => ({ value: one.id, label: one.name })));

  /** Stated before it is taken: both change the definition from a click on the picture. */
  let pending = $state<string | undefined>(undefined);

  const placement = $derived(series.find((one) => one.reads === measureKey));
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: measure?.label ?? "Series" },
        { label }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Group" mono>{row.group}</PanelField>
    <PanelField label="Series">{measure?.label ?? "—"}</PanelField>
    <PanelField label="Value" mono>{number(value)}</PanelField>
    <PanelField label="Rank">{rank} of {drawn.length} drawn</PanelField>
  </PanelFields>

  <PanelMeter
    label="Share of {measure?.label ?? 'the series'}"
    detail="{share}% of {number(total)} drawn"
    value={value}
    max={total}
  />

  <PanelSection title="Series">
    <PanelSelect
      label="Series"
      value={measureKey}
      options={MEASURES}
      onchange={(next: string) => (chosenSeries = next)}
    />
    <PanelNote>
      {#if placement}
        Drawn from {placement.reads} — {placement.aggregation.toLowerCase()} over the rows in this
        group.
      {:else}
        This series is not in the current definition.
      {/if}
    </PanelNote>
    <PanelNote>
      The tallest bar in it is {number(tallest)}; this one is {number(value)}.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Drawing">
    <PanelSelect
      label="Colour"
      value={colour.id}
      options={COLOURS}
      onchange={(next: string) => (recoloured = next)}
    />
    <PanelSwatches label="Colour" layout="column">
      <PanelSwatch name={colour.name} color="var({colour.token})" value={colour.token} selected />
    </PanelSwatches>
    <PanelFields>
      <PanelField label="Label" stacked>
        <PanelEditableText
          label="Bar label"
          value={label}
          placeholder={row.group}
          onchange={(next: string) => (relabelled = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A colour belongs to a series and a label belongs to a value, so neither of these is a
      property of one bar. Per-bar overrides would need somewhere to key them, and there is
      nowhere.
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
        title="Keep only rows where the group is {row.group}"
        onclick={() => (pending = `Adds ${row.group} is kept and everything else dropped.`)}
      />
      <PanelButton
        label="Exclude"
        icon={Ban}
        title="Drop rows where the group is {row.group}"
        onclick={() => (pending = `Adds a rule dropping ${row.group}.`)}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Both change the definition from a click on the picture. That is the right gesture, and it has
      to be undoable in one step before either can actually take it.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
