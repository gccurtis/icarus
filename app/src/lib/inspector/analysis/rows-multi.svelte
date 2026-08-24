<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Funnel from "@lucide/svelte/icons/funnel";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelMeter,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelStat,
    PanelStats
  } from "$lib/unique-components/panel";
  import { analysis, resultFor, sortIn } from "$mock-capabilities/analysis";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Several rows of the table, shift-clicked.
   *
   * **It edits all of them; it does not merely list them.** A property the
   * selection disagrees on is drawn as Mixed and typing over it sets every
   * member — a panel that showed one member's answer for all of them would
   * silently overwrite two values the reader never saw.
   *
   * **Where they agree, they say so rather than saying Mixed.** Mixed is a claim
   * about disagreement, and using it for "several things" would make the one
   * state that matters unreadable.
   *
   * **Together sums each measure separately.** Customer-minutes and event counts
   * are different units; a single combined figure across them would be a number
   * with no name.
   *
   * The selection arrives as `at`: a comma-separated list of row ids.
   */
  let { analysisId, at }: { analysisId?: string; at?: string } = $props();

  const view = viewState();

  const chosen = $derived(view.selection);
  const id = $derived(analysisId ?? "r-minutes");

  const record = $derived(analysis(id).current);
  const result = $derived(resultFor(id).current);
  const order = $derived(sortIn(id).current);

  const number = (count: number) => count.toLocaleString("en-GB");

  const measures = $derived(result.columns.filter((column) => column.role === "measure"));
  const group = $derived(result.columns.find((column) => column.role === "group"));

  const fallback = $derived(result.rows.slice(0, 3).map((one) => one.id).join(","));

  const ids = $derived(
    (at ?? (chosen?.kind === "rows" ? chosen.at : undefined) ?? fallback).split(",")
  );
  const members = $derived(result.rows.filter((one) => ids.includes(one.id)));

  /* Set on all of them at once. Absent means nobody has typed over the members' own. */
  let setLabel = $state<string | undefined>(undefined);

  const groups = $derived(new Set(members.map((one) => one.group)));
  const mixedLabel = $derived(setLabel === undefined && groups.size > 1);
  const label = $derived(setLabel ?? [...groups][0] ?? "");

  /**
   * Kept per row rather than as one answer for the selection. Nothing stores a
   * row's visibility, so every member reads Shown until told otherwise — but a
   * selection that later covers rows this panel set differently is genuinely
   * mixed, and one shared value could never report that.
   */
  let visibilityOf = $state<Record<string, string>>({});

  const visibilities = $derived(new Set(members.map((one) => visibilityOf[one.id] ?? "Shown")));
  const mixedVisibility = $derived(visibilities.size > 1);
  const visibility = $derived(mixedVisibility ? "" : ([...visibilities][0] ?? "Shown"));

  /** One control over several rows means nothing unless it sets every one of them. */
  const showAll = (next: string) => {
    const settings: Record<string, string> = { ...visibilityOf };
    for (const one of members) settings[one.id] = next;
    visibilityOf = settings;
  };

  const VISIBILITIES = [
    { value: "Shown", label: "Shown" },
    { value: "Hidden", label: "Hidden" }
  ] as const;

  /* Together, one figure per measure — the units do not mix. */
  const sumOf = (index: number) =>
    members.reduce((total, one) => total + (one.values[index] ?? 0), 0);
  const allOf = (index: number) =>
    result.rows.reduce((total, one) => total + (one.values[index] ?? 0), 0);

  const lead = $derived(sumOf(0));
  const leadAll = $derived(allOf(0));
  const share = $derived(leadAll === 0 ? 0 : Math.round((lead / leadAll) * 100));

  const positions = $derived(
    members
      .map((one) => result.rows.findIndex((other) => other.id === one.id) + 1)
      .sort((left, right) => left - right)
  );

  let pending = $state<string | undefined>(undefined);

  const listOf = (words: readonly string[]) =>
    words.length < 2
      ? (words[0] ?? "")
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

  const names = $derived(listOf([...groups]));
</script>

<Panel title="{members.length} rows">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: record.title, key: "analysis.analysis" },
        { label: `${members.length} rows` }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Selection" count={members.length} flush>
    {#each members as one (one.id)}
      <!-- The state goes in `sub`, so setting the whole selection hidden is visible row by row. -->
      <PanelRow
        title={one.group}
        sub={visibilityOf[one.id] === "Hidden" ? "Hidden" : measures[0]?.label}
        meta={number(one.values[0] ?? 0)}
        onselect={() => view.inspect("analysis.mark", { kind: "mark", id: one.id })}
      />
    {/each}
    <PanelNote>Everything below applies to all {members.length} of them.</PanelNote>
  </PanelSection>

  <PanelSection title="Together">
    <PanelFields>
      {#each measures as column, index (column.key)}
        <PanelField label={column.label} mono>{number(sumOf(index))}</PanelField>
      {/each}
    </PanelFields>
    <PanelMeter
      label="Share of {measures[0]?.label ?? 'the measure'}"
      detail="{share}% of {number(leadAll)} drawn"
      value={lead}
      max={leadAll}
    />
    <PanelStats label="Selection" columns={2}>
      <PanelStat value={number(members.length)} label="of {result.rows.length} rows" />
      <PanelStat value="{positions[0]}–{positions[positions.length - 1]}" label="positions" />
    </PanelStats>
    {#if order !== null}
      <PanelNote>Positions are by {order.reads}, {order.direction.toLowerCase()}.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="In common">
    <PanelFields>
      <PanelField label={group?.label ?? "Label"} stacked>
        <PanelEditableText
          label="Label"
          value={mixedLabel ? "" : label}
          mixed={mixedLabel}
          placeholder="Empty"
          onchange={(next: string) => (setLabel = next)}
        />
      </PanelField>
    </PanelFields>
    <PanelChoice
      label="Visibility"
      value={visibility}
      options={VISIBILITIES}
      mixed={mixedVisibility}
      onchange={showAll}
    />
    {#if mixedLabel}
      <PanelNote>
        {members.length} different names, so there is no honest one to start from. Typing here sets
        all of them.
      </PanelNote>
    {/if}
    {#if !mixedVisibility}
      <PanelNote>All {members.length} are {visibility.toLowerCase()}.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Neither a label nor a hidden flag on a group survives a reload. A row is something the
      evaluator produced, and per-value overrides need a table nobody has designed.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Filter to these"
        icon={Funnel}
        title="Keep only {names}"
        onclick={() => (pending = `Adds ${group?.key ?? "the group"} is one of ${names}.`)}
      />
      <PanelButton
        label="Exclude these"
        icon={Ban}
        title="Drop {names}"
        onclick={() => (pending = `Adds ${group?.key ?? "the group"} is not one of ${names}.`)}
      />
    </PanelActions>
    {#if pending !== undefined}
      <PanelNote>{pending}</PanelNote>
    {/if}
    <PanelNote tone="gap">
      A rule over several values needs an <i>is one of</i> operator. The filter model has is, is
      not, ≥, ≤ and between, so this would arrive as {members.length} rules or not at all.
    </PanelNote>
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here writes back. Every control holds its answer locally until an analysis definition
    exists to save it into.
  </PanelNote>
</Panel>
