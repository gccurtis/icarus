<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Funnel from "@lucide/svelte/icons/funnel";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect,
    PanelStat,
    PanelStats
  } from "$lib/unique-components/panel";
  import { analysis, chartFor, placementsOn, resultFor } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Several bars, shift-clicked: the selection as a group.
   *
   * **A multiple selection is a thing in its own right, not a list of things.**
   * The reason to open this panel is to change all of them at once, so the bands
   * are the properties they share — and a property they disagree on is drawn as
   * Mixed rather than as whichever member the panel happened to read first.
   * Typing over Mixed sets every member, which is the only honest way to edit
   * three values through one control.
   *
   * **Together is a band because it is why anyone shift-clicks bars.** Four bars
   * summing to two thirds of the chart is the answer someone was after, and it
   * is refused rather than printed when the members are summarised differently —
   * customer-minutes and event counts do not add.
   *
   * The selection arrives as `at`: a comma-separated list of `row:series` pairs,
   * because a bar is a group and a series and neither identifies one alone.
   */
  let { analysisId, at }: { analysisId?: string; at?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const display = $derived(chartFor(id).current);
  const result = $derived(resultFor(id).current);
  const placed = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const measures = $derived(result.columns.filter((column) => column.role === "measure"));

  /**
   * Three bars across two series by default, so the panel opens on the state it
   * exists for. A demo default where everything agrees hides the whole point.
   */
  const fallback = $derived(
    [
      `${result.rows[0]?.id}:${measures[0]?.key}`,
      `${result.rows[1]?.id}:${measures[0]?.key}`,
      `${result.rows[2]?.id}:${measures[1]?.key ?? measures[0]?.key}`
    ].join(",")
  );

  const members = $derived(
    (at ?? (chosen?.kind === "bars" ? chosen.at : undefined) ?? fallback)
      .split(",")
      .map((part) => {
        const [rowId, ...rest] = part.split(":");
        const key = rest.join(":");
        const row = result.rows.find((one) => one.id === rowId);
        const index = measures.findIndex((one) => one.key === key);
        const column = measures[Math.max(0, index)];
        return {
          id: part,
          group: row?.group ?? rowId,
          rowId: row?.id ?? rowId,
          series: column?.key ?? "",
          seriesLabel: column?.label ?? "",
          value: row?.values[Math.max(0, index)] ?? 0
        };
      })
      .filter((member) => member.series !== "")
  );

  /* What they agree on. A property is mixed when the members disagree about it. */
  let setSeries = $state<string | undefined>(undefined);
  let setColour = $state<string | undefined>(undefined);
  let setLabel = $state<string | undefined>(undefined);

  const seriesKeys = $derived(new Set(members.map((member) => member.series)));
  const mixedSeries = $derived(setSeries === undefined && seriesKeys.size > 1);
  const series = $derived(setSeries ?? [...seriesKeys][0] ?? "");

  /** Colour follows the series, so two series is two colours. */
  const colourOf = (key: string) => {
    const index = Math.max(0, measures.findIndex((one) => one.key === key));
    return display.colours[index % display.colours.length];
  };
  const mixedColour = $derived(setColour === undefined && seriesKeys.size > 1);
  const colour = $derived(
    display.colours.find((one) => one.id === setColour)?.id ?? colourOf(series).id
  );

  /** Labels are group names, so several bars never agree unless one is selected twice. */
  const groups = $derived(new Set(members.map((member) => member.group)));
  const mixedLabel = $derived(setLabel === undefined && groups.size > 1);
  const label = $derived(setLabel ?? [...groups][0] ?? "");

  const aggregationOf = (key: string) => placed.find((one) => one.reads === key)?.aggregation;
  const aggregations = $derived(
    new Set(members.map((member) => aggregationOf(member.series) ?? "Each value"))
  );
  const mixedAggregation = $derived(aggregations.size > 1);

  const MEASURES = $derived(measures.map((one) => ({ value: one.key, label: one.label })));
  const COLOURS = $derived(display.colours.map((one) => ({ value: one.id, label: one.name })));

  /* Together. */
  const values = $derived(members.map((member) => member.value));
  const sum = $derived(values.reduce((total, one) => total + one, 0));
  const largest = $derived(values.length === 0 ? 0 : Math.max(...values));
  const smallest = $derived(values.length === 0 ? 0 : Math.min(...values));

  /** Everything drawn in the series the selection sits in, when it sits in one. */
  const inSeries = $derived(
    mixedSeries
      ? []
      : result.rows.map(
          (row) => row.values[Math.max(0, measures.findIndex((one) => one.key === series))] ?? 0
        )
  );
  const seriesTotal = $derived(inSeries.reduce((total, one) => total + one, 0));

  let pending = $state<string | undefined>(undefined);

  const listOf = (words: readonly string[]) =>
    words.length < 2
      ? (words[0] ?? "")
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

  const names = $derived(listOf([...groups]));
</script>

<Panel title="{members.length} bars">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: `${members.length} bars` }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Selection" count={members.length} flush>
    {#each members as member (member.id)}
      <PanelRow
        title={member.group}
        sub={member.seriesLabel}
        meta={number(member.value)}
        onselect={() => view.inspect("analysis.mark", { kind: "mark", id: member.rowId })}
      />
    {/each}
    <PanelNote>Everything below applies to all {members.length} of them.</PanelNote>
  </PanelSection>

  <PanelSection title="In common">
    <PanelFields>
      <PanelField label="Series" stacked>
        <PanelSelect
          label="Series"
          value={series}
          options={MEASURES}
          mixed={mixedSeries}
          onchange={(next: string) => (setSeries = next)}
        />
      </PanelField>
      <PanelField label="Colour" stacked>
        <PanelSelect
          label="Colour"
          value={colour}
          options={COLOURS}
          mixed={mixedColour}
          onchange={(next: string) => (setColour = next)}
        />
      </PanelField>
      <PanelField label="Label" stacked>
        <PanelEditableText
          label="Label"
          value={mixedLabel ? "" : label}
          mixed={mixedLabel}
          placeholder="Empty"
          onchange={(next: string) => (setLabel = next)}
        />
      </PanelField>
      <PanelField label="Summarised">
        {mixedAggregation ? "Mixed" : ([...aggregations][0] ?? "—")}
      </PanelField>
    </PanelFields>

    {#if mixedSeries}
      <PanelNote>These bars come from {seriesKeys.size} different series.</PanelNote>
    {/if}
    {#if setSeries !== undefined || setColour !== undefined || setLabel !== undefined}
      <PanelNote>Set on all {members.length}.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Summarised is shown and not offered. Changing it here would rewrite two placements from a
      selection made on the picture, and that is a bigger act than this panel should take quietly.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Together">
    {#if mixedAggregation}
      <!-- The reason the band refuses rather than printing a number: units. -->
      <PanelNote>
        These are summarised differently, so they do not add. Select bars from one series to see a
        total.
      </PanelNote>
      <PanelStats label="Selection" columns={2}>
        <PanelStat value={number(largest)} label="largest" />
        <PanelStat value={number(smallest)} label="smallest" />
      </PanelStats>
    {:else}
      <PanelStats label="Selection">
        <PanelStat value={number(sum)} label="together" />
        <PanelStat value={number(largest)} label="largest" />
        <PanelStat value={number(smallest)} label="smallest" />
      </PanelStats>
      {#if !mixedSeries && seriesTotal > 0}
        <PanelNote>
          {Math.round((sum / seriesTotal) * 100)}% of the {number(seriesTotal)} drawn in {measures.find(
            (one) => one.key === series
          )?.label}.
        </PanelNote>
      {/if}
    {/if}
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Filter to these"
        icon={Funnel}
        title="Keep only {names}"
        onclick={() => (pending = `Adds a rule keeping ${names} and nothing else.`)}
      />
      <PanelButton
        label="Exclude these"
        icon={Ban}
        title="Drop {names}"
        onclick={() => (pending = `Adds a rule dropping ${names}.`)}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
