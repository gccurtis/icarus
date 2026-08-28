<script lang="ts">
  import Replace from "@lucide/svelte/icons/replace";
  import Undo2 from "@lucide/svelte/icons/undo-2";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelInput,
    PanelNote,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import { analysis, chartFor, placementsOn, resultFor } from "$capabilities/analysis";
  import type { LegendPosition } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Everything the Labels button under the chart offers: what the picture says,
   * and what is drawn at all.
   *
   * **A label toggle is the text going away, not a flag.** `ChartDisplay` holds
   * strings and a legend position; nothing in it says "hidden". So switching a
   * label off empties it and switching it back on restores what was there — one
   * value with one meaning, rather than a flag and a string that can disagree
   * about whether an axis is labelled.
   *
   * **Replace acts on the labels, never on the data.** "Feeder 12" on the axis
   * is a value in `substations.name`, and rewriting it here would be a chart
   * quietly disagreeing with the table it came from.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const display = $derived(chartFor(id).current);
  const series = $derived(placementsOn(id, "y").current);
  const result = $derived(resultFor(id).current);

  /** The edits, until there is a definition to write them to. */
  let retitled = $state<string | undefined>(undefined);
  let relabelledX = $state<string | undefined>(undefined);
  let relabelledY = $state<string | undefined>(undefined);
  let relegended = $state<LegendPosition | undefined>(undefined);
  let renamed = $state<Record<string, string>>({});

  const title = $derived(retitled ?? display.title);
  const xLabel = $derived(relabelledX ?? display.xLabel);
  const yLabel = $derived(relabelledY ?? display.yLabel);
  const legend = $derived(relegended ?? display.legend);

  const labelOf = (placementId: string, fallback: string) => renamed[placementId] ?? fallback;

  /**
   * What the text was before it was switched off. Without it, switching a label
   * back on gives you the saved value rather than the one you had just typed —
   * which reads as the panel throwing an edit away.
   */
  let keptTitle = $state<string | undefined>(undefined);
  let keptX = $state<string | undefined>(undefined);
  let keptY = $state<string | undefined>(undefined);
  let keptLegend = $state<LegendPosition | undefined>(undefined);

  const showTitle = (on: boolean) => {
    if (on) retitled = keptTitle ?? display.title;
    else {
      keptTitle = title;
      retitled = "";
    }
  };

  const showX = (on: boolean) => {
    if (on) relabelledX = keptX ?? display.xLabel;
    else {
      keptX = xLabel;
      relabelledX = "";
    }
  };

  const showY = (on: boolean) => {
    if (on) relabelledY = keptY ?? display.yLabel;
    else {
      keptY = yLabel;
      relabelledY = "";
    }
  };

  const showLegend = (on: boolean) => {
    if (on) relegended = keptLegend ?? (display.legend === "None" ? "Right" : display.legend);
    else {
      keptLegend = legend;
      relegended = "None";
    }
  };

  const LEGENDS = [
    { value: "Right", label: "Right" },
    { value: "Bottom", label: "Bottom" }
  ] as const;

  /** Neither is a persisted encoding. They toggle, and the gap note says where they go: nowhere. */
  let valueLabels = $state(false);
  let gridlines = $state(true);

  /* Replacements. */
  let find = $state("");
  let instead = $state("");
  let said = $state<string | undefined>(undefined);

  const swap = (text: string) => (find === "" ? text : text.split(find).join(instead));

  const replaceEverywhere = () => {
    if (find === "") {
      said = "Type what to find first.";
      return;
    }

    let changed = 0;
    const step = (text: string) => {
      const next = swap(text);
      if (next !== text) changed += 1;
      return next;
    };

    retitled = step(title);
    relabelledX = step(xLabel);
    relabelledY = step(yLabel);

    const next: Record<string, string> = {};
    for (const one of series) next[one.id] = step(labelOf(one.id, one.label));
    renamed = next;

    said =
      changed === 0
        ? `Nothing on the chart says “${find}”.`
        : `Replaced “${find}” in ${changed} label${changed === 1 ? "" : "s"}.`;
  };

  const revert = () => {
    retitled = undefined;
    relabelledX = undefined;
    relabelledY = undefined;
    relegended = undefined;
    renamed = {};
    keptTitle = undefined;
    keptX = undefined;
    keptY = undefined;
    keptLegend = undefined;
    said = "Back to the saved labels.";
  };

  /** The first few tick labels, so the band below is about something visible. */
  const ticks = $derived(result.rows.slice(0, 3).map((row) => row.group).join(", "));
</script>

<Panel title="Labels">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Labels" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Revert" icon={Undo2} onclick={revert} />
  {/snippet}

  <PanelSection title="Show">
    <PanelToggle label="Chart title" checked={title !== ""} onchange={showTitle} />
    <PanelToggle label="X label" checked={xLabel !== ""} onchange={showX} />
    <PanelToggle label="Y label" checked={yLabel !== ""} onchange={showY} />
    <PanelToggle label="Legend" checked={legend !== "None"} onchange={showLegend} />
    {#if legend !== "None"}
      <PanelFields>
        <PanelField label="Legend" stacked>
          <PanelSelect
            label="Legend position"
            value={legend}
            options={LEGENDS}
            onchange={(next: string) => (relegended = next as LegendPosition)}
          />
        </PanelField>
      </PanelFields>
    {/if}
    <PanelToggle
      label="Value on each bar"
      checked={valueLabels}
      onchange={(next: boolean) => (valueLabels = next)}
    />
    <PanelToggle
      label="Gridlines"
      checked={gridlines}
      onchange={(next: boolean) => (gridlines = next)}
    />
    <PanelNote tone="gap">
      The last two have nowhere to live. A chart carries a title, two axis labels and a legend
      position, and nothing about values on bars or gridlines survives a reload.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Text">
    <PanelFields>
      <PanelField label="Title" stacked>
        <PanelEditableText
          label="Chart title"
          value={title}
          multiline
          placeholder="Untitled chart"
          onchange={(next: string) => (retitled = next)}
        />
      </PanelField>
      <PanelField label="X" stacked>
        <PanelEditableText
          label="X axis label"
          value={xLabel}
          placeholder="Unlabelled"
          onchange={(next: string) => (relabelledX = next)}
        />
      </PanelField>
      <PanelField label="Y" stacked>
        <PanelEditableText
          label="Y axis label"
          value={yLabel}
          placeholder="Unlabelled"
          onchange={(next: string) => (relabelledY = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelNote>
      The analysis carries a title of its own. This one is what the picture says; that one is what
      the saved thing is called.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Series" count={series.length}>
    <PanelFields>
      {#each series as one (one.id)}
        <PanelField label={one.reads} stacked>
          <PanelEditableText
            label="Label for {one.reads}"
            value={labelOf(one.id, one.label)}
            placeholder={one.field}
            onchange={(next: string) => (renamed = { ...renamed, [one.id]: next })}
          />
        </PanelField>
      {/each}
    </PanelFields>
    <PanelNote>
      What the legend calls each series. It starts from the field name, which is rarely what a
      chart should say.
    </PanelNote>
  </PanelSection>

  <!--
    One find and one replace across every label at once, because the labels are
    written by four different things — the chart, two axes and each series — and
    a name that was wrong is wrong in all of them.
  -->
  <PanelSection title="Replace">
    <PanelFields>
      <PanelField label="Find" stacked>
        <PanelInput label="Find" bind:value={find} placeholder="Text on the chart" mono flush />
      </PanelField>
      <PanelField label="With" stacked>
        <PanelInput label="Replace with" bind:value={instead} placeholder="Leave empty to delete" mono flush />
      </PanelField>
    </PanelFields>
    <PanelActions>
      <PanelButton label="Replace in labels" icon={Replace} onclick={replaceEverywhere} />
    </PanelActions>
    {#if said !== undefined}
      <PanelNote>{said}</PanelNote>
    {/if}
    <PanelNote>
      Labels only. The names along the axis — {ticks} — are values in the data, and this does not
      touch them.
    </PanelNote>
    <PanelNote tone="gap">
      Renaming a category for display has nowhere to be stored. It is either a change to the source
      or a per-chart alias table, and neither exists.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
