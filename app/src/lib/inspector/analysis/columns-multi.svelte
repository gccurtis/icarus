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
    PanelRow,
    PanelSection,
    PanelSelect,
    PanelStat,
    PanelStats
  } from "$lib/unique-components/panel";
  import { aggregationsFor, analysis, placementsOn, resultFor } from "$mock-capabilities/analysis";
  import type { Aggregation } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Several columns of the table, shift-clicked.
   *
   * **The offered aggregations are the intersection, not the union.** Three
   * columns of three types share only what all three permit, and offering Sum
   * because one of them is a number would set it on two that cannot take it.
   *
   * **Mixed is computed from the members, never assumed from their number.**
   * Alignment differs here because it follows the role — names lead, figures
   * trail — and the panel says so rather than picking one and calling it the
   * answer.
   *
   * The selection arrives as `at`: a comma-separated list of column keys.
   */
  let { analysisId, at }: { analysisId?: string; at?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const across = $derived(placementsOn(id, "x").current);
  const up = $derived(placementsOn(id, "y").current);

  const placements = $derived([...across, ...up]);

  const fallback = $derived(result.columns.map((one) => one.key).join(","));

  const keys = $derived(
    (at ?? (chosen?.kind === "columns" ? chosen.at : undefined) ?? fallback).split(",")
  );
  const members = $derived(result.columns.filter((one) => keys.includes(one.key)));

  const placementFor = (key: string) => placements.find((one) => one.reads === key);

  /* Role. Not editable — a column is a group or a measure because of where its field sits. */
  const roles = $derived(new Set(members.map((one) => one.role)));
  const mixedRole = $derived(roles.size > 1);

  /* Summarise by, over what every member's type permits. */
  const permitted = $derived(
    members
      .map((one) => aggregationsFor(placementFor(one.key)?.type ?? "text").current)
      .reduce<readonly Aggregation[]>(
        (shared, next) => shared.filter((one) => next.includes(one)),
        members.length === 0 ? [] : aggregationsFor(placementFor(members[0].key)?.type ?? "text").current
      )
  );

  let setAggregation = $state<Aggregation | undefined>(undefined);

  const aggregations = $derived(
    new Set(members.map((one) => placementFor(one.key)?.aggregation ?? "Each value"))
  );
  const mixedAggregation = $derived(setAggregation === undefined && aggregations.size > 1);
  const aggregation = $derived(setAggregation ?? [...aggregations][0] ?? "Each value");

  const AGGREGATIONS = $derived(permitted.map((one) => ({ value: one, label: one })));

  /* Heading. */
  let setHeading = $state<string | undefined>(undefined);

  const headings = $derived(new Set(members.map((one) => one.label)));
  const mixedHeading = $derived(setHeading === undefined && headings.size > 1);
  const heading = $derived(setHeading ?? [...headings][0] ?? "");

  /* Alignment follows the role, which is exactly why it is mixed here. */
  let setAlignment = $state<string | undefined>(undefined);

  const alignments = $derived(
    new Set(members.map((one) => (one.role === "measure" ? "Trailing" : "Leading")))
  );
  const mixedAlignment = $derived(setAlignment === undefined && alignments.size > 1);
  const alignment = $derived(setAlignment ?? [...alignments][0] ?? "Leading");

  const ALIGNMENTS = [
    { value: "Leading", label: "Leading" },
    { value: "Trailing", label: "Trailing" }
  ] as const;

  const measures = $derived(members.filter((one) => one.role === "measure").length);

  /** Removing them leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () => view.inspect("analysis.analysis", { kind: "analysis", id });
</script>

<Panel title="{members.length} columns">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: `${members.length} columns` }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Selection" count={members.length} flush>
    {#each members as one (one.key)}
      <PanelRow
        title={one.label}
        sub={one.key}
        meta={one.role === "measure" ? "Measure" : "Group"}
        onselect={() => {
          const placed = placementFor(one.key);
          if (placed) view.inspect("analysis.placement", { kind: "placement", id: placed.id });
        }}
      />
    {/each}
    <PanelNote>Everything below applies to all {members.length} of them.</PanelNote>
  </PanelSection>

  <PanelStats label="Selection" columns={2}>
    <PanelStat value={String(measures)} label="measures" />
    <PanelStat value={String(members.length - measures)} label="group columns" />
  </PanelStats>

  <PanelSection title="In common">
    <PanelFields>
      <PanelField label="Role">{mixedRole ? "Mixed" : ([...roles][0] ?? "—")}</PanelField>
      <PanelField label="Heading" stacked>
        <PanelEditableText
          label="Heading"
          value={mixedHeading ? "" : heading}
          mixed={mixedHeading}
          placeholder="Empty"
          onchange={(next: string) => (setHeading = next)}
        />
      </PanelField>
      <PanelField label="Summarise" stacked>
        <PanelSelect
          label="Summarise by"
          value={aggregation}
          options={AGGREGATIONS}
          mixed={mixedAggregation}
          onchange={(next: string) => (setAggregation = next as Aggregation)}
        />
      </PanelField>
    </PanelFields>

    <PanelChoice
      label="Alignment"
      value={alignment}
      options={ALIGNMENTS}
      mixed={mixedAlignment}
      onchange={(next: string) => (setAlignment = next)}
    />

    {#if mixedRole}
      <PanelNote>
        A group column and a measure in one selection. Summarising applies to the measures; the
        group column names the rows and would collapse them.
      </PanelNote>
    {/if}
    {#if permitted.length < 6}
      <PanelNote>
        Only {permitted.length} aggregation{permitted.length === 1 ? "" : "s"} here: these are the
        ones every selected column's type permits.
      </PanelNote>
    {/if}
    {#if setAggregation !== undefined || setHeading !== undefined || setAlignment !== undefined}
      <PanelNote>Set on all {members.length}.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      One heading across several columns makes them indistinguishable. The field is offered because
      a shared prefix is the common case, and there is no way to edit part of a value through a
      control that replaces the whole of it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Remove {members.length}"
        icon={Trash2}
        tone="danger"
        onclick={remove}
      />
    </PanelActions>
    <PanelNote>Removing these columns removes the placements that produced them.</PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
