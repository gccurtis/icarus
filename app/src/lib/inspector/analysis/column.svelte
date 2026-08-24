<script lang="ts">
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";
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
    PanelSection,
    PanelSelect,
    PanelStat,
    PanelStats,
    PanelTable,
    PanelToggle
  } from "$lib/unique-components/panel";
  import {
    aggregationsFor,
    analysis,
    placementsOn,
    resultFor,
    sortIn
  } from "$mock-capabilities/analysis";
  import type { Aggregation, SortRule } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One column of the table: the placement behind it, and what it does to the
   * rows.
   *
   * **A column is a placement wearing a heading.** Everything that decides what
   * is in it — the field, the summarising — belongs to the placement, so this
   * lens edits those rather than inventing a parallel set beside them.
   *
   * **The group column is not a measure and is not offered one.** Summarising
   * the column that names the rows would collapse the rows themselves, so the
   * band says what it is instead of showing a control that must not be used.
   *
   * **Order by this column is the sort, not a column property.** A table with two
   * columns each claiming their own order has no order at all.
   */
  let { analysisId, columnKey }: { analysisId?: string; columnKey?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const order = $derived(sortIn(id).current);
  const across = $derived(placementsOn(id, "x").current);
  const up = $derived(placementsOn(id, "y").current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const placements = $derived([...across, ...up]);

  const column = $derived(
    result.columns.find(
      (one) => one.key === (columnKey ?? (chosen?.kind === "column" ? chosen.id : undefined))
    ) ?? result.columns[0]
  );

  const at = $derived(result.columns.findIndex((one) => one.key === column.key));
  const measureAt = $derived(
    result.columns.filter((one) => one.role === "measure").findIndex((one) => one.key === column.key)
  );

  const placement = $derived(placements.find((one) => one.reads === column.key));
  const isMeasure = $derived(column.role === "measure");

  /* Summarise by — the placement's own set, which the field's type decides. */
  const permitted = $derived(aggregationsFor(placement?.type ?? "text").current);

  let resummarised = $state<Aggregation | undefined>(undefined);

  const aggregation = $derived(
    permitted.find((one) => one === (resummarised ?? placement?.aggregation)) ?? permitted[0]
  );
  const AGGREGATIONS = $derived(permitted.map((one) => ({ value: one, label: one })));

  /* Heading. */
  let relabelled = $state<string | undefined>(undefined);
  const heading = $derived(relabelled ?? column.label);

  /* Order. */
  let ordering = $state<boolean | undefined>(undefined);
  let reversed = $state<SortRule["direction"] | undefined>(undefined);

  const ordersThis = $derived(order !== null && order.placementId === placement?.id);
  const sorted = $derived(ordering ?? ordersThis);
  const direction = $derived(reversed ?? order?.direction ?? "High to low");

  const DIRECTIONS = [
    { value: "Low to high", label: "Low to high" },
    { value: "High to low", label: "High to low" }
  ] as const;

  /* Drawing. Neither is a stored property; the gap note says so. */
  let alignment = $state("Trailing");
  const ALIGNMENTS = [
    { value: "Leading", label: "Leading" },
    { value: "Trailing", label: "Trailing" }
  ] as const;

  /* The values in it, which is what makes the heading worth reading. */
  const values = $derived(
    isMeasure ? result.rows.map((row) => row.values[measureAt] ?? 0) : []
  );
  const total = $derived(values.reduce((sum, one) => sum + one, 0));
  const largest = $derived(values.length === 0 ? 0 : Math.max(...values));
  const smallest = $derived(values.length === 0 ? 0 : Math.min(...values));

  /**
   * The rows as this column's own order would put them. The Order band is
   * directly above the preview, so an order it claims and the preview ignores is
   * a claim the reader can see is false.
   */
  const ordered = $derived.by(() => {
    const rows = [...result.rows];
    if (!sorted || !isMeasure) return rows;
    const sign = direction === "High to low" ? -1 : 1;
    return rows.sort(
      (left, right) => sign * ((left.values[measureAt] ?? 0) - (right.values[measureAt] ?? 0))
    );
  });

  const preview = $derived(
    ordered.slice(0, 3).map((row) => [row.group, number(row.values[measureAt] ?? 0)])
  );

  /** Removing the column leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () => view.inspect("analysis.analysis", { kind: "analysis", id });
</script>

<Panel title={heading}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: heading }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Open as a placement"
      icon={SquareArrowOutUpRight}
      disabled={placement === undefined}
      title={placement === undefined
        ? "This column has no placement behind it."
        : "Edit the field this column came from"}
      onclick={() => {
        if (placement) view.inspect("analysis.placement", { kind: "placement", id: placement.id });
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Key" mono>{column.key}</PanelField>
    <PanelField label="Role">{isMeasure ? "Measure" : "Group"}</PanelField>
    <PanelField label="Position">{at + 1} of {result.columns.length}</PanelField>
    {#if placement}
      <PanelField label="From" mono>{placement.variable}.{placement.field}</PanelField>
      <PanelField label="Type">{placement.type}</PanelField>
    {/if}
  </PanelFields>

  <PanelSection title="Heading">
    <PanelEditableText
      label="Column heading"
      value={heading}
      placeholder={column.key}
      onchange={(next: string) => (relabelled = next)}
    />
    <PanelNote>
      What the column says. It starts from the field name, which is rarely what a table should be
      headed.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Summarise by">
    {#if isMeasure}
      <PanelChoice
        label="Summarise by"
        value={aggregation}
        options={AGGREGATIONS}
        onchange={(next: string) => (resummarised = next as Aggregation)}
      />
      {#if permitted.length < 6}
        <PanelNote>
          A {placement?.type ?? "text"} field takes only these. The rest are offered where the type
          allows them.
        </PanelNote>
      {/if}
    {:else}
      <PanelNote>
        This column names the rows. Summarising it would collapse the rows it is naming, so there
        is nothing to choose.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Order">
    <PanelToggle
      label="Order the table by this column"
      checked={sorted}
      disabled={placement === undefined}
      onchange={(next: boolean) => (ordering = next)}
    />
    {#if sorted}
      <PanelChoice
        label="Direction"
        value={direction}
        options={DIRECTIONS}
        onchange={(next: string) => (reversed = next as SortRule["direction"])}
      />
      <PanelNote>The rows come back by {column.label}, {direction.toLowerCase()}.</PanelNote>
    {:else if order !== null}
      <PanelNote>Ordered by {order.reads} instead — one table, one order.</PanelNote>
    {:else}
      <PanelNote>Nothing orders the table, so the rows arrive as they grouped.</PanelNote>
    {/if}
    <PanelActions>
      <PanelButton
        label="Sort"
        icon={ArrowDownWideNarrow}
        onclick={() => view.inspect("analysis.sort", { kind: "analysis", id })}
      />
    </PanelActions>
  </PanelSection>

  {#if isMeasure}
    <PanelSection title="Values">
      <PanelStats label="Column">
        <PanelStat value={number(total)} label="total" />
        <PanelStat value={number(largest)} label="largest" />
        <PanelStat value={number(smallest)} label="smallest" />
      </PanelStats>
      <PanelTable
        columns={[result.columns[0]?.label ?? "Group", column.label]}
        rows={preview}
        total={result.rows.length}
        unit="rows"
      />
      <PanelNote tone="gap">
        The total is a sum of sums. For an average or a count of distinct values that is the wrong
        answer, and the evaluator would have to return it rather than the panel adding a column up.
      </PanelNote>
    </PanelSection>
  {/if}

  <PanelSection title="Drawing" open={false}>
    <PanelFields>
      <PanelField label="Align" stacked>
        <PanelSelect
          label="Alignment"
          value={alignment}
          options={ALIGNMENTS}
          onchange={(next: string) => (alignment = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Alignment and width are not properties a column can hold. Figures are drawn trailing and
      names leading because of the type, which is a rule rather than a setting.
    </PanelNote>
  </PanelSection>

  <!-- Destructive, and last. -->
  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Remove" icon={Trash2} tone="danger" onclick={remove} />
    </PanelActions>
    <PanelNote>Removing the column removes the placement that produced it.</PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
