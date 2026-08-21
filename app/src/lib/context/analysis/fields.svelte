<script lang="ts">
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import Braces from "@lucide/svelte/icons/braces";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Funnel from "@lucide/svelte/icons/funnel";
  import Hash from "@lucide/svelte/icons/hash";
  import ListOrdered from "@lucide/svelte/icons/list-ordered";
  import ToggleLeft from "@lucide/svelte/icons/toggle-left";
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { filtersIn, limitIn, placementsOn, sortIn } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The builder: where each field has been put.
   *
   * `docs/screen-panel-views/context/analysis/fields.md` is the specification.
   * Each section is a drop zone and each row is a placement that opens its own
   * lens, so the panel is read top to bottom as the query is read: what is
   * across, what is up, what is kept, what order, how much.
   *
   * **The zones are named for what they do to the picture** — across, up —
   * rather than for the query operation behind them. A person putting a field on
   * X is deciding what the bars stand for, not writing a GROUP BY.
   *
   * **An empty zone says so.** A zone that draws nothing is indistinguishable
   * from a zone that failed to load, and picking a chart kind that wants another
   * field opens exactly such a zone.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const across = $derived(placementsOn(analysisId, "x").current);
  const up = $derived(placementsOn(analysisId, "y").current);
  const filters = $derived(filtersIn(analysisId).current);
  const sort = $derived(sortIn(analysisId).current);
  const limit = $derived(limitIn(analysisId).current);

  /** The same glyphs the Variables panel uses, so a field keeps its type across the drop. */
  const ICON = {
    text: Type,
    number: Hash,
    date: Calendar,
    logic: ToggleLeft,
    range: Braces
  };

  const rows = (count: number) => count.toLocaleString("en-GB");
</script>

<Panel title="Fields">
  <PanelSection title="X — across" flush>
    {#each across as placed (placed.id)}
      <PanelRow
        title={placed.reads}
        sub={placed.label}
        meta={placed.type}
        icon={ICON[placed.type]}
        selected={mockWorkbench.selection?.id === placed.id}
        onselect={() =>
          mockWorkbench.inspect("analysis.placement", { kind: "placement", id: placed.id })}
      />
    {/each}

    {#if across.length === 0}
      <PanelNote>Nothing across yet. Drop a field here, or add one from the menu.</PanelNote>
    {/if}
  </PanelSection>

  <!-- Several are allowed, and each one is a series. -->
  <PanelSection title="Y — up" count={up.length} flush>
    {#each up as placed (placed.id)}
      <PanelRow
        title={placed.reads}
        sub={placed.label}
        meta={placed.type}
        icon={ICON[placed.type]}
        selected={mockWorkbench.selection?.id === placed.id}
        onselect={() =>
          mockWorkbench.inspect("analysis.placement", { kind: "placement", id: placed.id })}
      />
    {/each}

    {#if up.length === 0}
      <PanelNote>Nothing up yet. Drop a field here, or add one from the menu.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Filters" count={filters.length} flush>
    <!--
      A rule that removes nothing is usually a mistake, and the row cannot say so
      without both numbers, so both are on it.
    -->
    {#each filters as rule (rule.id)}
      <PanelRow
        title={rule.reads}
        sub="kept {rows(rule.rowsKept)} of {rows(rule.rowsIn)}"
        icon={Funnel}
        tone={rule.rowsKept === rule.rowsIn ? "attention" : "default"}
        selected={mockWorkbench.selection?.id === rule.id}
        onselect={() => mockWorkbench.inspect("analysis.filter", { kind: "filter", id: rule.id })}
      />
    {/each}

    {#if filters.length === 0}
      <PanelNote>Every row is kept.</PanelNote>
    {/if}
  </PanelSection>

  <!--
    A sort targets what is on an axis, aggregation included — never a bare source
    field — which is why the row reads `sum of customerMinutes` and not
    `customerMinutes`.
  -->
  <PanelSection title="Sort" flush>
    {#if sort === null}
      <PanelNote>Unsorted. The result comes back in the order the grouping produced it.</PanelNote>
    {:else}
      <PanelRow
        title="{sort.reads}, {sort.direction.toLowerCase()}"
        icon={ArrowDownWideNarrow}
        selected={mockWorkbench.selection?.id === sort.id}
        onselect={() => mockWorkbench.inspect("analysis.sort", { kind: "sort", id: sort.id })}
      />
    {/if}
  </PanelSection>

  <PanelSection title="Limit" flush>
    {#if limit === null}
      <PanelNote>No limit. Every group is drawn.</PanelNote>
    {:else}
      <PanelRow
        title="Top {limit.keep}"
        meta="of {rows(limit.of)}"
        icon={ListOrdered}
        selected={mockWorkbench.selection?.id === limit.id}
        onselect={() => mockWorkbench.inspect("analysis.limit", { kind: "limit", id: limit.id })}
      />
    {/if}
  </PanelSection>

  <PanelNote tone="gap">
    Nothing here can be added or removed yet: there is no door that writes a placement. Filters and
    sorts carry no stable identifiers in the model either, so a selection on one cannot survive a
    reload and cannot be collaborated on.
  </PanelNote>
</Panel>
