<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import MoveRight from "@lucide/svelte/icons/move-right";
  import Trash2 from "@lucide/svelte/icons/trash-2";

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
    PanelSection
  } from "$lib/unique-components/panel";
  import { aggregationsFor, analysis, placement } from "$mock-capabilities/analysis";
  import type { Aggregation, PlacementAxis } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * One field on an axis: which field, how it is summarised, what it is called on
   * the chart.
   *
   * `docs/screen-panel-views/inspector/analysis/placement.md` is the
   * specification. This is the most common selection while building — a
   * placement is a field plus a decision about how to collapse it.
   *
   * **What the row reads is derived, not stored.** Changing the aggregation
   * changes the name of the thing being inspected, so the title and the trail
   * follow the control rather than lagging a revision behind it.
   *
   * **Move to Filters is refused while the placement is summarised.** Moving an
   * aggregated placement to Filters has no obvious meaning; refusing is the half
   * of that question this panel can answer honestly.
   */
  let {
    placementId = "p-y1",
    analysisId = "r-minutes"
  }: { placementId?: string; analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const placed = $derived(placement(placementId).current);

  /** The set the field's type permits: a text field cannot be summed. */
  const permitted = $derived(aggregationsFor(placed.type).current);

  /** The edits, until there is a definition to write them to. */
  let resummarised = $state<Aggregation | undefined>(undefined);
  let relabelled = $state<string | undefined>(undefined);
  let moved = $state<PlacementAxis | undefined>(undefined);
  let note = $state<string | undefined>(undefined);

  const aggregation = $derived(resummarised ?? placed.aggregation);
  const label = $derived(relabelled ?? placed.label);
  const axis = $derived(moved ?? placed.axis);

  const AGGREGATIONS = $derived(permitted.map((one) => ({ value: one, label: one })));

  /** The same shape a zone row reads and a sort names its target by. */
  const reads = $derived(
    aggregation === "Each value"
      ? `${placed.variable}.${placed.field}`
      : `${aggregation.toLowerCase()} of ${placed.field}`
  );

  const ZONE: Record<PlacementAxis, string> = {
    x: "X — across",
    y: "Y — up",
    colour: "Colour"
  };

  const other = $derived(axis === "x" ? "y" : "x");
  const summarised = $derived(aggregation !== "Each value");

  const move = () => {
    moved = other;
    note = undefined;
  };

  const toFilters = () => {
    note = `${placed.variable}.${placed.field} moved to Filters.`;
  };

  /** Removing the placement leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () =>
    mockWorkbench.inspect("analysis.analysis", { kind: "analysis", id: analysisId });
</script>

<Panel title={reads}>
  {#snippet crumbs()}
    <!-- The zone is in the trail, so moving the placement is visible where it happened. -->
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: ZONE[axis] },
        { label: reads }
      ]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <!-- Naming the source variable matters: two variables can both have a `name` column. -->
  <PanelFields>
    <PanelField label="From" mono>{placed.variable}</PanelField>
    <PanelField label="Field" mono>{placed.field}</PanelField>
    <PanelField label="Type">{placed.type}</PanelField>
  </PanelFields>

  <PanelSection title="Summarise by">
    <PanelChoice
      label="Summarise by"
      value={aggregation}
      options={AGGREGATIONS}
      onchange={(next: string) => (resummarised = next as Aggregation)}
    />
    {#if permitted.length < 6}
      <!-- Why the set is short, so a missing option does not read as a missing feature. -->
      <PanelNote>
        A {placed.type} field takes only these. The rest are offered where the type allows them.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Label">
    <PanelEditableText
      label="Axis label"
      value={label}
      placeholder={placed.field}
      onchange={(next: string) => (relabelled = next)}
    />
    <PanelNote>
      What the axis says. It starts from the field name, which is rarely what a chart should be
      labelled.
    </PanelNote>
  </PanelSection>

  <!-- Destructive last, after the two moves. -->
  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Move to {other.toUpperCase()}"
        icon={MoveRight}
        onclick={move}
      />
      <PanelButton
        label="Move to Filters"
        icon={Funnel}
        disabled={summarised}
        title={summarised
          ? `A placement summarised by ${aggregation.toLowerCase()} has no meaning as a filter.`
          : "Filter rows by this field instead of drawing them"}
        onclick={toFilters}
      />
      <PanelButton label="Remove" icon={Trash2} tone="danger" onclick={remove} />
    </PanelActions>
    {#if note !== undefined}
      <PanelNote>{note}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Whether an aggregated placement should instead drop its aggregation on the way to Filters is
      undecided. This panel refuses the move rather than guessing.
    </PanelNote>
  </PanelSection>
</Panel>
