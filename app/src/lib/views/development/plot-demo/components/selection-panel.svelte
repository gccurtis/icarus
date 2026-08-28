<script lang="ts">
  import type { ChartSelection } from "$authored-components/chart";
  import { readMarkId } from "$authored-components/chart";
  import {
    Panel,
    PanelButton,
    PanelActions,
    PanelChip,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";

  /**
   * What is selected in the chart, and what could be done with it.
   *
   * **The panel is the argument for marks.** A chart that is one picture can
   * only be inspected as one picture; a chart made of addressable marks can be
   * asked "what is this bar", and everything a presentation tool does — recolour
   * this one, pull that slice out, annotate this segment — hangs off the answer.
   * None of those actions exist yet, and the panel says so rather than drawing
   * buttons that do nothing.
   *
   * **What it offers depends on the selection's shape.** One bar, a whole
   * column, a whole series and an arbitrary handful are four different subjects,
   * and a panel that showed the same fields for all four would be describing
   * none of them.
   */
  let {
    selection,
    data,
    series,
    format
  }: {
    selection: ChartSelection;
    data: readonly Record<string, unknown>[];
    series: readonly { key: string; label?: string }[];
    format: (value: number) => string;
  } = $props();

  const labelOf = (key: string) => series.find((entry) => entry.key === key)?.label ?? key;

  const chosen = $derived(
    selection.ids.map((id) => {
      const { category, seriesKey } = readMarkId(id);
      const row = data.find((entry) => String(entry.region) === category);
      const value = seriesKey === "total" ? 0 : Number(row?.[seriesKey] ?? 0);
      return { id, category, seriesKey, value };
    })
  );

  const sum = $derived(chosen.reduce((total, mark) => total + mark.value, 0));

  const SHAPE: Record<string, string> = {
    none: "Nothing",
    one: "One mark",
    category: "A whole column",
    series: "A whole series",
    many: "Several marks"
  };
</script>

<Panel title={selection.isEmpty ? "Nothing selected" : SHAPE[selection.shape]}>
  {#if !selection.isEmpty}
    {#snippet actions()}
      <PanelButton label="Clear" onclick={() => selection.clear()} />
    {/snippet}
  {/if}

  {#if selection.isEmpty}
    <PanelNote>
      Click a bar or a slice. Shift-click to add another, click a category label
      for the whole column, or a legend entry for the whole series.
    </PanelNote>
  {:else}
    <PanelSection title="What is selected" count={selection.count}>
      <PanelFields>
        <PanelField label="Shape">
          <PanelChip tone="active">{SHAPE[selection.shape]}</PanelChip>
        </PanelField>
        {#if selection.shape === "one"}
          <PanelField label="Region">{chosen[0].category}</PanelField>
          <PanelField label="Cause">{labelOf(chosen[0].seriesKey)}</PanelField>
          <PanelField label="Value" mono>{format(chosen[0].value)}</PanelField>
        {:else}
          <PanelField label="Marks" mono>{selection.count}</PanelField>
          <PanelField label="Sum" mono>{format(sum)}</PanelField>
        {/if}
      </PanelFields>
    </PanelSection>

    {#if selection.count > 1}
      <PanelSection title="Each one" count={selection.count} flush>
        {#each chosen as mark (mark.id)}
          <PanelRow
            title={`${mark.category} · ${labelOf(mark.seriesKey)}`}
            meta={format(mark.value)}
            onselect={() => selection.click(mark.id)}
          />
        {/each}
      </PanelSection>
    {/if}

    <PanelSection title="What you could do">
      <PanelActions>
        <PanelButton label="Recolour" disabled title="Per-mark colour is not built yet" />
        <PanelButton label="Annotate" disabled title="Annotations are not built yet" />
        <PanelButton label="Pull out" disabled title="Only a pie slice can be pulled out, and only by selecting it" />
      </PanelActions>
      <PanelNote tone="gap">
        None of these exist yet. They are drawn disabled with their reason because
        they are the point of having marks at all — every one of them is an
        operation on a selection, and until now there was no selection to hang
        them from.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
