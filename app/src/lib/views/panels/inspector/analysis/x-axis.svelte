<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import GitCompareArrows from "@lucide/svelte/icons/git-compare-arrows";

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
    PanelToggle
  } from "$components/authored/panel";
  import {
    analysis,
    filtersIn,
    placementsOn,
    relationship,
    sortIn,
    tablesIn
  } from "$capabilities/analysis";
  import type { FilterOperator, JoinMode, SortRule } from "$capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Everything the X-Axis button under the chart offers, at full width: select
   * data, create join, sort, set condition.
   *
   * **The axis is the subject, not the placement.** The customisation strip has
   * one button per axis, so the lens it opens has to be about the axis — which
   * field is on it is the first thing the lens *asks*, not the thing it was
   * opened on. `analysis.placement` is the other lens, for a field already
   * placed.
   *
   * **The join band appears because of what is on the other axis.** Two
   * variables in play is what makes a join necessary, so switching the source
   * above makes the band open or close rather than sitting there permanently as
   * a step to get through.
   *
   * **Changing the variable clears the field.** A field name carried across from
   * the previous table usually names a column that is not there — and where it
   * does exist it is worse, because `regionId` is on both of these and the axis
   * would quietly re-point at another table's column under the same name.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const tables = $derived(tablesIn(view.project).current);
  const placed = $derived(placementsOn(id, "x").current);
  const opposite = $derived(placementsOn(id, "y").current);
  const rules = $derived(filtersIn(id).current);
  const order = $derived(sortIn(id).current);
  const relate = $derived(relationship(id).current);

  /** X holds one field. Y is the axis that stacks several, and it says so itself. */
  const first = $derived(placed[0]);

  /* Select data. */
  let chosenSource = $state<string | undefined>(undefined);
  let chosenField = $state<string | undefined>(undefined);

  const variableName = $derived(chosenSource ?? first?.variable ?? tables[0].name);
  const table = $derived(tables.find((one) => one.name === variableName) ?? tables[0]);
  const field = $derived(
    table.fields.find((one) => one.name === (chosenField ?? first?.field)) ?? table.fields[0]
  );

  const SOURCES = $derived(
    tables.map((one) => ({ value: one.name, label: `${one.name} · ${one.rows} rows` }))
  );
  const FIELDS = $derived(
    table.fields.map((one) => ({ value: one.name, label: `${one.name} · ${one.type}` }))
  );

  /* Create join. */
  const candidates = $derived([relate.key, ...relate.alternatives]);

  let matchId = $state<string | undefined>(undefined);
  let keeping = $state<JoinMode | undefined>(undefined);

  const match = $derived(
    candidates.find((one) => one.id === (matchId ?? relate.key.id)) ?? relate.key
  );
  const mode = $derived(keeping ?? relate.mode);
  const across = $derived(opposite[0]?.variable);
  const needsJoin = $derived(across !== undefined && across !== variableName);

  const MATCHES = $derived(
    candidates.map((one) => ({ value: one.id, label: `${one.left} → ${one.right}` }))
  );

  const MODES = [
    { value: "With a match", label: "With a match" },
    { value: "All on the left", label: "All on the left" },
    { value: "All on the right", label: "All on the right" },
    { value: "All of both", label: "All of both" }
  ] as const;

  /* Sort. */
  const TARGETS = $derived(
    [...placed, ...opposite].map((one) => ({ value: one.id, label: one.reads }))
  );

  let ordering = $state<boolean | undefined>(undefined);
  let retargeted = $state<string | undefined>(undefined);
  let reversed = $state<SortRule["direction"] | undefined>(undefined);

  const sorted = $derived(ordering ?? order !== null);
  const target = $derived(retargeted ?? order?.placementId ?? TARGETS[0]?.value ?? "");
  const direction = $derived(reversed ?? order?.direction ?? "High to low");
  const reads = $derived(TARGETS.find((one) => one.value === target)?.label ?? "");

  const DIRECTIONS = [
    { value: "Low to high", label: "Low to high" },
    { value: "High to low", label: "High to low" }
  ] as const;

  /* Set condition. */
  const OPERATORS = [
    { value: "is", label: "is" },
    { value: "is not", label: "is not" },
    { value: "≥", label: "≥" },
    { value: "≤", label: "≤" },
    { value: "between", label: "between" }
  ] as const;

  let operator = $state<FilterOperator>("is");
  let against = $state("");
  let added = $state<string | undefined>(undefined);

  /** Only the conditions on the variable this axis reads: the rest are another axis's. */
  const conditions = $derived(rules.filter((rule) => rule.variable === variableName));

  const add = () => {
    added = `Keep rows where ${variableName}.${field.name} ${operator} ${against === "" ? "…" : against}.`;
  };
</script>

<Panel title="X — across">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "X — across" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

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
    <PanelNote>
      What the bars stand for. One bar per distinct {field.name}, in the order the sort below
      gives them.
    </PanelNote>
  </PanelSection>

  <!--
    Open only while it is a real problem. A join band standing there permanently
    reads as a modelling stage to complete before anything can be drawn, which is
    exactly the interface this screen exists to avoid.
  -->
  <PanelSection title="Create join" open={needsJoin}>
    {#if needsJoin}
      <PanelNote>
        X reads <b>{variableName}</b> and Y reads <b>{across}</b>. The chart needs to know which
        rows belong together.
      </PanelNote>
      <PanelFields>
        <PanelField label="Match on" stacked>
          <PanelSelect
            label="Match on"
            value={match.id}
            options={MATCHES}
            onchange={(next: string) => (matchId = next)}
          />
        </PanelField>
      </PanelFields>
      <PanelChoice
        label="Keep rows"
        value={mode}
        options={MODES}
        onchange={(next: string) => (keeping = next as JoinMode)}
      />
      <PanelNote>Matches {match.matched} of {match.of} rows. {match.note}</PanelNote>
      <PanelActions>
        <PanelButton
          label="Open the relationship"
          icon={GitCompareArrows}
          onclick={() => view.inspect("analysis.relationship", { kind: "analysis", id })}
        />
      </PanelActions>
      <PanelNote tone="gap">
        The pairings are inferred and listed in the order the inference gave them. A high match
        count is not on its own a good key — a region reaches every substation and is still wrong.
      </PanelNote>
    {:else}
      <PanelNote>
        Both axes read {variableName}, so there is nothing to join. Point this axis at another
        variable and the pairing appears here.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Sort">
    <PanelToggle
      label="Order this axis"
      checked={sorted}
      onchange={(next: boolean) => (ordering = next)}
    />
    {#if sorted}
      <PanelFields>
        <PanelField label="By" stacked>
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
      <!-- The target is a placement, never a bare field: `customerMinutes` and
           `sum of customerMinutes` order the bars differently. -->
      <PanelNote>The bars come back by {reads}, {direction.toLowerCase()}.</PanelNote>
    {:else}
      <PanelNote>Unordered — the groups arrive in whatever order they group in.</PanelNote>
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
      The value is typed as text whatever the field's type is. A date picker for a date and a range
      for a number wait on a column-schema contract.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
