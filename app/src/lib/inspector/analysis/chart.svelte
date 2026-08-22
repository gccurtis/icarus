<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { analysis, chartFor, chartKinds } from "$mock-capabilities/analysis";
  import type { ChartKindId, LegendPosition } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * How the result is drawn: the kind, the picture's own title, the axes, the
   * legend and the colours.
   *
   * `docs/screen-panel-views/inspector/analysis/chart.md` is the specification.
   *
   * **The title here is the picture's, not the saved thing's.** The analysis has
   * one of its own and it is edited in its own lens: one is what the chart says,
   * the other is what the saved thing is called.
   *
   * **Kind is the first band because every band under it changes meaning once it
   * changes.** What the chosen kind draws with is stated under it as guidance —
   * the minimum-field rules are undefined, so picking a kind that wants another
   * field opens an empty zone for it rather than refusing.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const view = viewState();

  const record = $derived(analysis(analysisId).current);
  const display = $derived(chartFor(analysisId).current);
  const kinds = $derived(chartKinds().current);

  /** The edits, until there is a definition to write them to. */
  let redrawn = $state<ChartKindId | undefined>(undefined);
  let retitled = $state<string | undefined>(undefined);
  let relabelledX = $state<string | undefined>(undefined);
  let relabelledY = $state<string | undefined>(undefined);
  let rebased = $state<boolean | undefined>(undefined);
  let restacked = $state<boolean | undefined>(undefined);
  let relegended = $state<LegendPosition | undefined>(undefined);

  const kind = $derived(redrawn ?? display.kind);
  const title = $derived(retitled ?? display.title);
  const xLabel = $derived(relabelledX ?? display.xLabel);
  const yLabel = $derived(relabelledY ?? display.yLabel);
  const zeroBased = $derived(rebased ?? display.zeroBased);
  const stacked = $derived(restacked ?? display.stacked);
  const legend = $derived(relegended ?? display.legend);

  const KINDS = $derived(kinds.map((one) => ({ value: one.id, label: one.name })));
  const needs = $derived(kinds.find((one) => one.id === kind)?.needs ?? "");

  const LEGENDS = [
    { value: "None", label: "None" },
    { value: "Right", label: "Right" },
    { value: "Bottom", label: "Bottom" }
  ] as const;
</script>

<Panel {title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: title }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Kind">
    <PanelChoice
      label="Kind"
      value={kind}
      options={KINDS}
      onchange={(next: string) => (redrawn = next as ChartKindId)}
    />
    <PanelNote>{needs}</PanelNote>
  </PanelSection>

  <PanelSection title="Title">
    <PanelEditableText
      label="Chart title"
      value={title}
      multiline
      placeholder="Untitled chart"
      onchange={(next: string) => (retitled = next)}
    />
    <PanelNote tone="gap">
      The analysis carries a title too. Two titles is one too many if nobody ever sets them
      differently.
    </PanelNote>
  </PanelSection>

  <!--
    The labels and the two flags are one band because they are one decision:
    what the axes say, and what they imply. A Y axis that does not start at zero
    is a claim about the shape of the bars, not a formatting preference.
  -->
  <PanelSection title="Axes">
    <PanelFields>
      <PanelField label="X label" stacked>
        <PanelEditableText
          label="X axis label"
          value={xLabel}
          placeholder="Unlabelled"
          onchange={(next: string) => (relabelledX = next)}
        />
      </PanelField>
      <PanelField label="Y label" stacked>
        <PanelEditableText
          label="Y axis label"
          value={yLabel}
          placeholder="Unlabelled"
          onchange={(next: string) => (relabelledY = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelToggle
      label="Y starts at zero"
      checked={zeroBased}
      onchange={(next: boolean) => (rebased = next)}
    />
    <PanelToggle
      label="Stacked"
      checked={stacked}
      onchange={(next: boolean) => (restacked = next)}
    />
  </PanelSection>

  <PanelSection title="Legend" open={false}>
    <PanelChoice
      label="Legend"
      value={legend}
      options={LEGENDS}
      onchange={(next: string) => (relegended = next as LegendPosition)}
    />
  </PanelSection>

  <PanelSection title="Colours" open={false}>
    <!--
      Role tokens rather than values, so a chart pasted into a slide comes out in
      the deck's palette instead of carrying four colours from another document.
    -->
    <div class="swatches">
      {#each display.colours as colour (colour.id)}
        <div class="swatch">
          <span
            class="chip border-border-subtle rounded-control border"
            style="background: var({colour.token})"
          ></span>
          <span class="text-caption text-ink-secondary">{colour.name}</span>
        </div>
      {/each}
    </div>
  </PanelSection>

  <PanelSection title="Not yet modeled" open={false}>
    <PanelNote tone="gap">
      Colour, size, detail, label and tooltip are not persisted encodings. The empty Colour zone
      the builder shows is a proposal, not something that can be saved today.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  .swatches {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .swatch {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .chip {
    width: calc(var(--token-spacing-unit) * 4);
    height: calc(var(--token-spacing-unit) * 4);
    flex-shrink: 0;
  }
</style>
