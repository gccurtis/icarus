<script lang="ts">
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
  import { analysis, filter } from "$mock-capabilities/analysis";
  import type { FilterOperator } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * One rule about which rows are kept.
   *
   * `docs/screen-panel-views/inspector/analysis/filter.md` is the specification.
   *
   * **It is phrased as *keep rows where*, not as a condition.** A filter stated
   * as a bare comparison leaves the direction ambiguous, and a reader who guesses
   * the wrong way reads every number under it backwards.
   *
   * **Effect is a band rather than a caption.** A filter with no visible effect
   * is usually a mistake, and the panel cannot say so without both counts.
   */
  let {
    filterId = "f-1",
    analysisId = "r-minutes"
  }: { filterId?: string; analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const rule = $derived(filter(filterId).current);

  /** The edits, until there is a definition to write them to. */
  let recompared = $state<FilterOperator | undefined>(undefined);
  let revalued = $state<string | undefined>(undefined);

  const operator = $derived(recompared ?? rule.operator);
  const value = $derived(revalued ?? rule.value);

  const OPERATORS = [
    { value: "is", label: "is" },
    { value: "is not", label: "is not" },
    { value: "≥", label: "≥" },
    { value: "≤", label: "≤" },
    { value: "between", label: "between" }
  ] as const;

  /** Named by its variable, because two variables can both have a `name` column. */
  const field = $derived(`${rule.variable}.${rule.field}`);

  /** Derived rather than read, so the title follows the edit above it. */
  const reads = $derived(`${rule.field} ${operator} ${value}`);

  const rows = (count: number) => count.toLocaleString("en-GB");
  const removed = $derived(rule.rowsIn - rule.rowsKept);

  /** Removing the rule leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () =>
    mockWorkbench.inspect("analysis.analysis", { kind: "analysis", id: analysisId });
</script>

<Panel title={reads}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: reads }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Field" mono>{field}</PanelField>
  </PanelFields>

  <PanelChoice
    label="Keep rows where"
    value={operator}
    options={OPERATORS}
    onchange={(next: string) => (recompared = next as FilterOperator)}
  />

  <PanelFields>
    <PanelField label="Value" stacked>
      <PanelEditableText
        label="Value"
        value={value}
        mono
        placeholder="Empty"
        onchange={(next: string) => (revalued = next)}
      />
    </PanelField>
  </PanelFields>

  <PanelSection title="Effect">
    <PanelNote>{rows(rule.rowsIn)} rows in, {rows(rule.rowsKept)} kept.</PanelNote>
    {#if removed === 0}
      <!-- The reason the band exists: a rule that removes nothing is usually a mistake. -->
      <PanelNote>This filter removed nothing.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Per-filter counts take a run with this rule and a run without it. Whether that is affordable
      needs checking before the band is promised.
    </PanelNote>
  </PanelSection>

  <!-- Destructive, and last. -->
  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Remove" icon={Trash2} tone="danger" onclick={remove} />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Types" open={false}>
    <PanelNote tone="gap">
      The field is a {rule.type}, and the value above is still edited as text. A date picker for a
      date and a range for a number wait on a column-schema and type-inference contract for
      heterogeneous table values.
    </PanelNote>
  </PanelSection>
</Panel>
