<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import GitCompareArrows from "@lucide/svelte/icons/git-compare-arrows";
  import Plus from "@lucide/svelte/icons/plus";

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
  } from "$lib/unique-components/panel";
  import {
    analysis,
    filtersIn,
    placementsOn,
    relationship,
    sortIn,
    tablesIn
  } from "$mock-capabilities/analysis";
  import type { FilterOperator, JoinMode, SortRule } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Everything the Y-Axis button under the chart offers, at full width: select
   * data, create join, sort, set condition.
   *
   * The same four bands as `x-axis`, and deliberately so — an axis is an axis,
   * and two panels that answered the same four questions in two shapes would be
   * two things to learn.
   *
   * **Y is the axis that stacks.** X holds one field and Y holds a series each,
   * so this one opens on a list and asks which series the bands below are about.
   * Writing it as a single hidden subject would make the second series
   * unreachable from the button that owns it.
   *
   * **How a series is summarised is shown and not set here.** `sum of` versus
   * `count of` is what the Data button decides; repeating the control would give
   * one value two owners and let them disagree.
   */
  let { analysisId }: { analysisId?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(
    analysisId ?? (chosen?.kind === "analysis" ? chosen.id : undefined) ?? "r-minutes"
  );

  const record = $derived(analysis(id).current);
  const tables = $derived(tablesIn(view.project).current);
  const placed = $derived(placementsOn(id, "y").current);
  const opposite = $derived(placementsOn(id, "x").current);
  const rules = $derived(filtersIn(id).current);
  const order = $derived(sortIn(id).current);
  const relate = $derived(relationship(id).current);

  /* Which series the bands below are about. `at` names it when the strip opened on one. */
  let seriesId = $state<string | undefined>(undefined);
  const series = $derived(
    placed.find((one) => one.id === (seriesId ?? chosen?.at)) ?? placed[0]
  );

  /* Select data. */
  let chosenSource = $state<string | undefined>(undefined);
  let chosenField = $state<string | undefined>(undefined);

  const variableName = $derived(chosenSource ?? series?.variable ?? tables[0].name);
  const table = $derived(tables.find((one) => one.name === variableName) ?? tables[0]);
  const field = $derived(
    table.fields.find((one) => one.name === (chosenField ?? series?.field)) ?? table.fields[0]
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
  const along = $derived(opposite[0]?.variable);
  const needsJoin = $derived(along !== undefined && along !== variableName);

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
    [...opposite, ...placed].map((one) => ({ value: one.id, label: one.reads }))
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

  let operator = $state<FilterOperator>("≥");
  let against = $state("");
  let added = $state<string | undefined>(undefined);

  const conditions = $derived(rules.filter((rule) => rule.variable === variableName));

  const add = () => {
    added = `Keep rows where ${variableName}.${field.name} ${operator} ${against === "" ? "…" : against}.`;
  };

  /** No definition to append to, so the offer is stated rather than taken. */
  let proposed = $state<string | undefined>(undefined);
</script>

<Panel title="Y — up">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Y — up" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Series" count={placed.length} flush>
    {#each placed as one (one.id)}
      <PanelRow
        title={one.reads}
        sub={one.label}
        tone={one.id === series?.id ? "active" : "default"}
        selected={one.id === series?.id}
        onselect={() => (seriesId = one.id)}
      />
    {/each}
    <PanelActions>
      <PanelButton
        label="Add a series"
        icon={Plus}
        onclick={() => (proposed = `A second measure would be drawn beside ${series?.reads}.`)}
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
      <PanelField label="Summarised">{series?.aggregation ?? "Each value"}</PanelField>
    </PanelFields>
    <PanelNote>
      How tall the bars are. Summarising is set on the Data button, so this band shows it rather
      than offering a second control over the same value.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Create join" open={needsJoin}>
    {#if needsJoin}
      <PanelNote>
        Y reads <b>{variableName}</b> and X reads <b>{along}</b>. The chart needs to know which
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
        Every series on this axis shares the one relationship. Two series from two different
        variables would need two, and the model holds one.
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
      label="Order by this axis"
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
    <!--
      A condition on a summarised series is two different rules — before the
      summarising or after it — and the model has one filter list. Saying so is
      the half of the question this panel can answer.
    -->
    <PanelNote tone="gap">
      A condition here narrows the rows before they are summarised. Filtering on the summarised
      value instead — bars over a million — would need a rule that runs after grouping, and there
      is no such stage.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
