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
    PanelRow,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { analysis, placementsOn, resultFor, sortIn } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One row of the table: the group it names, and every measure under it.
   *
   * **A row is a group, not a source record.** Six rows came back from 4,182
   * events, so "this row" is a substation and the events are underneath it —
   * which is why What is underneath is a button rather than the body of the
   * panel.
   *
   * **Where it sits is a fact about the sort.** Third of six means nothing
   * without saying third by what, so the rank carries the ordering that produced
   * it or says there is none.
   */
  let { analysisId, rowId }: { analysisId?: string; rowId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const order = $derived(sortIn(id).current);
  const placed = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const row = $derived(
    result.rows.find((one) => one.id === (rowId ?? (chosen?.kind === "row" ? chosen.id : undefined))) ??
      result.rows[0]
  );

  const measures = $derived(result.columns.filter((column) => column.role === "measure"));
  const group = $derived(result.columns.find((column) => column.role === "group"));

  const at = $derived(result.rows.findIndex((one) => one.id === row.id) + 1);

  /** The first measure is what the row is usually being read for, and what the sort orders by. */
  const lead = $derived(row.values[0] ?? 0);
  const total = $derived(result.rows.reduce((sum, one) => sum + (one.values[0] ?? 0), 0));
  const share = $derived(total === 0 ? 0 : Math.round((lead / total) * 100));

  const placementFor = (key: string) => placed.find((one) => one.reads === key);

  /* The edits, until there is a definition to write them to. */
  let relabelled = $state<string | undefined>(undefined);
  let hidden = $state(false);

  const label = $derived(relabelled ?? row.group);

  let pending = $state<string | undefined>(undefined);
</script>

<Panel title={label}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: group?.label ?? "Rows" },
        { label }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label={group?.label ?? "Group"} mono>{row.group}</PanelField>
    <PanelField label="Position">
      {at} of {result.rows.length}{order === null ? " — unordered" : ` by ${order.reads}`}
    </PanelField>
  </PanelFields>

  <PanelMeter
    label="Share of {measures[0]?.label ?? 'the measure'}"
    detail="{share}% of {number(total)} drawn"
    value={lead}
    max={total}
  />

  <!-- Each measure names the placement that produced it, so a cell opens the field behind it. -->
  <PanelSection title="Measures" count={measures.length} flush>
    {#each measures as column, index (column.key)}
      <PanelRow
        title={column.label}
        sub={column.key}
        meta={number(row.values[index] ?? 0)}
        onselect={() => {
          const one = placementFor(column.key);
          if (one) view.inspect("analysis.placement", { kind: "placement", id: one.id });
        }}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Drawing">
    <PanelFields>
      <PanelField label="Label" stacked>
        <PanelEditableText
          label="Row label"
          value={label}
          placeholder={row.group}
          onchange={(next: string) => (relabelled = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelToggle label="Hidden" checked={hidden} onchange={(next: boolean) => (hidden = next)} />
    {#if hidden}
      <PanelNote>
        Hidden from the table and still in the totals, which is the reading a filter would not
        give.
      </PanelNote>
    {/if}
    <PanelNote tone="gap">
      Neither survives a reload. A row is a group the evaluator produced, so a label or a hidden
      flag on one needs somewhere to key it — a per-value alias table nobody has designed.
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
    <PanelNote tone="gap">
      Both change the definition from a click on the table, which is the right gesture and one that
      has to be undoable in a single step.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
