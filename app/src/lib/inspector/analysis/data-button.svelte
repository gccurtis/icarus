<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import Plus from "@lucide/svelte/icons/plus";
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
    PanelSelect
  } from "$lib/unique-components/panel";
  import {
    aggregationsFor,
    analysis,
    filtersIn,
    placementsOn,
    resultFor,
    tablesIn
  } from "$mock-capabilities/analysis";
  import type { Aggregation, FilterOperator } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Everything the Data button under the chart offers: select data, select
   * aggregation, set condition.
   *
   * **Data is the measure, and the measure is a field plus a way of collapsing
   * it.** That is the whole of the difference between this and the two axis
   * lenses: an axis decides what a bar stands for, and this decides how tall it
   * is. It is also why aggregation lives here and is only *shown* on Y.
   *
   * **The permitted aggregations come from the field's type.** A text field
   * cannot be summed, so the set shrinks when the field changes rather than
   * offering six options and failing on four of them.
   *
   * **What it reads is derived, not stored.** Changing the aggregation changes
   * the name of the column it produces, so the heading follows the control
   * instead of lagging a revision behind it.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const tables = $derived(tablesIn(view.project).current);
  const measures = $derived(placementsOn(id, "y").current);
  const rules = $derived(filtersIn(id).current);
  const result = $derived(resultFor(id).current);

  /* Which measure the bands below are about. `at` names it when the strip opened on one. */
  let measureId = $state<string | undefined>(undefined);
  const measure = $derived(
    measures.find((one) => one.id === (measureId ?? chosen?.at)) ?? measures[0]
  );

  /* Select data. */
  let chosenSource = $state<string | undefined>(undefined);
  let chosenField = $state<string | undefined>(undefined);

  const variableName = $derived(chosenSource ?? measure?.variable ?? tables[0].name);
  const table = $derived(tables.find((one) => one.name === variableName) ?? tables[0]);
  const field = $derived(
    table.fields.find((one) => one.name === (chosenField ?? measure?.field)) ?? table.fields[0]
  );

  const SOURCES = $derived(
    tables.map((one) => ({ value: one.name, label: `${one.name} · ${one.rows} rows` }))
  );
  const FIELDS = $derived(
    table.fields.map((one) => ({ value: one.name, label: `${one.name} · ${one.type}` }))
  );

  /* Select aggregation. */
  const permitted = $derived(aggregationsFor(field.type).current);

  let resummarised = $state<Aggregation | undefined>(undefined);

  /**
   * The chosen aggregation, kept legal: switching to a text field while `Sum`
   * was on would otherwise leave a control showing a value its own set no longer
   * contains.
   */
  const aggregation = $derived(
    permitted.find((one) => one === (resummarised ?? measure?.aggregation)) ?? permitted[0]
  );

  const AGGREGATIONS = $derived(permitted.map((one) => ({ value: one, label: one })));

  /** The same string a zone row reads, a result column is keyed by, and a sort names. */
  const reads = $derived(
    aggregation === "Each value"
      ? `${variableName}.${field.name}`
      : `${aggregation.toLowerCase()} of ${field.name}`
  );

  /** Whether the chart is actually drawing this measure, or a proposal that is not in the result. */
  const drawn = $derived(result.columns.some((column) => column.key === reads));

  /* Set condition. */
  const OPERATORS = [
    { value: "is", label: "is" },
    { value: "is not", label: "is not" },
    { value: "≥", label: "≥" },
    { value: "≤", label: "≤" },
    { value: "between", label: "between" }
  ] as const;

  let operator = $state<FilterOperator>("≥");
  let against = $state("");
  let added = $state<string | undefined>(undefined);

  const conditions = $derived(rules.filter((rule) => rule.variable === variableName));

  const add = () => {
    added = `Keep rows where ${variableName}.${field.name} ${operator} ${against === "" ? "…" : against}, before summarising.`;
  };

  let proposed = $state<string | undefined>(undefined);
</script>

<Panel title={reads}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Data" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!--
    Pressing a row aims the bands below at it rather than opening the placement
    lens. Opening the lens is the way *out* of this panel, so it is a button
    under the list where it cannot be hit by accident.
  -->
  <PanelSection title="Measures" count={measures.length} flush>
    {#each measures as one (one.id)}
      <PanelRow
        title={one.reads}
        sub={one.label}
        tone={one.id === measure?.id ? "active" : "default"}
        selected={one.id === measure?.id}
        onselect={() => (measureId = one.id)}
      />
    {/each}
    <PanelActions>
      <PanelButton
        label="Add a measure"
        icon={Plus}
        onclick={() => (proposed = `${reads} would be drawn beside the measures above.`)}
      />
      <PanelButton
        label="Open as a placement"
        icon={SquareArrowOutUpRight}
        disabled={measure === undefined}
        onclick={() =>
          view.inspect("analysis.placement", { kind: "placement", id: measure?.id ?? "" })}
      />
    </PanelActions>
    {#if proposed !== undefined}
      <PanelNote>{proposed}</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Select data">
    <PanelFields>
      <PanelField label="From" stacked>
        <PanelSelect
          label="Variable"
          value={variableName}
          options={SOURCES}
          onchange={(next: string) => {
            chosenSource = next;
            chosenField = undefined;
          }}
        />
      </PanelField>
      <PanelField label="Field" stacked>
        <PanelSelect
          label="Field"
          value={field.name}
          options={FIELDS}
          onchange={(next: string) => (chosenField = next)}
        />
      </PanelField>
      <PanelField label="Type">{field.type}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Select aggregation">
    <PanelChoice
      label="Summarise by"
      value={aggregation}
      options={AGGREGATIONS}
      onchange={(next: string) => (resummarised = next as Aggregation)}
    />
    {#if permitted.length < 6}
      <!-- Why the set is short, so a missing option does not read as a missing feature. -->
      <PanelNote>
        A {field.type} field takes only these. The rest are offered where the type allows them.
      </PanelNote>
    {/if}
    <PanelNote>
      Each bar collapses the rows underneath it to one number, and this is how. {reads} is what the
      column is called wherever it appears.
    </PanelNote>
    {#if !drawn}
      <PanelNote>This combination is not in the current result. The chart still draws the saved one.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Set condition">
    {#if conditions.length > 0}
      {#each conditions as rule (rule.id)}
        <PanelRow
          title={rule.reads}
          meta="{rule.rowsKept} of {rule.rowsIn}"
          onselect={() => view.inspect("analysis.filter", { kind: "filter", id: rule.id })}
        />
      {/each}
    {:else}
      <PanelNote>Nothing narrows {variableName} yet.</PanelNote>
    {/if}

    <PanelChoice
      label="Keep rows where"
      value={operator}
      options={OPERATORS}
      onchange={(next: string) => (operator = next as FilterOperator)}
    />
    <PanelFields>
      <PanelField label="Value" stacked>
        <PanelEditableText
          label="Value"
          value={against}
          mono
          placeholder="Empty"
          onchange={(next: string) => (against = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelActions>
      <PanelButton label="Add condition" icon={Funnel} onclick={add} />
    </PanelActions>
    {#if added !== undefined}
      <PanelNote>{added}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      A condition on the measure runs before the summarising, which is the only stage there is. A
      rule about the summarised value — keep bars over a million — has nowhere to run.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
