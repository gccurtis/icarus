<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { analysis, placementsOn, sortIn } from "$capabilities/analysis";
  import type { SortRule } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * What the result is ordered by.
   *
   * `docs/screen-panel-views/inspector/analysis/sort.md` is the specification.
   *
   * **The target is a placement, never a bare source field.** Sorting by
   * `customerMinutes` when the chart shows `sum of customerMinutes` means
   * something else entirely, so the control offers what is on an axis and
   * nothing beyond it.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const view = viewState();

  const record = $derived(analysis(analysisId).current);
  const rule = $derived(sortIn(analysisId).current);
  const across = $derived(placementsOn(analysisId, "x").current);
  const up = $derived(placementsOn(analysisId, "y").current);

  const TARGETS = $derived(
    [...across, ...up].map((placed) => ({ value: placed.id, label: placed.reads }))
  );

  /** The edits, until there is a definition to write them to. */
  let retargeted = $state<string | undefined>(undefined);
  let reversed = $state<SortRule["direction"] | undefined>(undefined);

  const target = $derived(retargeted ?? rule?.placementId ?? "");
  const direction = $derived(reversed ?? rule?.direction ?? "High to low");
  const reads = $derived(TARGETS.find((one) => one.value === target)?.label ?? rule?.reads ?? "");

  const DIRECTIONS = [
    { value: "Low to high", label: "Low to high" },
    { value: "High to low", label: "High to low" }
  ] as const;

  /** Removing the rule leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () => view.inspect("analysis.analysis", { kind: "analysis", id: analysisId });
</script>

<Panel title="Sort">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Sort" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#if rule === null}
    <PanelNote>Nothing orders this result. The rows come back in whatever order they group in.</PanelNote>
  {:else}
    <PanelFields>
      <PanelField label="Field" stacked>
        <PanelSelect
          label="Sort by"
          value={target}
          options={TARGETS}
          onchange={(next: string) => (retargeted = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelChoice
      label="Direction"
      value={direction}
      options={DIRECTIONS}
      onchange={(next: string) => (reversed = next as SortRule["direction"])}
    />

    <PanelNote>The result comes back by {reads}, {direction.toLowerCase()}.</PanelNote>

    <!-- Destructive, and last. -->
    <PanelSection title="Actions">
      <PanelActions>
        <PanelButton label="Remove" icon={Trash2} tone="danger" onclick={remove} />
      </PanelActions>
      <PanelNote tone="gap">
        Only one sort is offered. Whether a second, as a tiebreak, is ever wanted is undecided —
        the model would need an ordered list rather than a single value.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
