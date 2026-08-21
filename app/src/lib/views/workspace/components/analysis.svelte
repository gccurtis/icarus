<script lang="ts">
  import type { Component } from "svelte";
  import Activity from "@lucide/svelte/icons/activity";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Filter from "@lucide/svelte/icons/filter";
  import Hash from "@lucide/svelte/icons/hash";
  import Plus from "@lucide/svelte/icons/plus";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Sigma from "@lucide/svelte/icons/sigma";
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";

  import { clientModel, type Tab } from "$model/client";
  import { PanelButton, PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenBanner,
    ScreenCard,
    ScreenCards,
    ScreenFilters,
    ScreenHeader,
    ScreenSurface
  } from "$lib/unique-components/screen";

  /**
   * Analysis — drop a field on an axis and see a chart.
   *
   * **The chart is centred at the top, before any control**, because it is the
   * thing being made. Everything below it is how it got that way.
   *
   * **There is no root, no input and no join step.** Variables are variables. A
   * relationship appears only when two are actually in play, stated as a problem
   * to solve rather than a modelling stage to get through first.
   *
   * Two captions under the chart are load-bearing: one stops a chart being
   * mistaken for a stored result, the other stops a truncated view being mistaken
   * for the whole.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  type LucideIconProps = { size?: number | string; "aria-hidden"?: boolean | "true" | "false" };

  let one = $state(true);

  const BARS = [
    { name: "Feeder 12", height: 100, selected: true },
    { name: "Eastbrook", height: 33 },
    { name: "Harlow", height: 24 },
    { name: "Ward 3", height: 17 },
    { name: "Millbrook", height: 12 },
    { name: "Deering", height: 9 }
  ];

  const KINDS = [
    "Table",
    "Bar",
    "Line",
    "Area",
    "Scatter",
    "Bubble",
    "Pie",
    "Waterfall",
    "Mekko",
    "Funnel",
    "Radar",
    "Heatmap",
    "Treemap"
  ];

  type Pill = { label: string; icon: Component<LucideIconProps>; on?: boolean };
  type Zone = { key: string; pills: readonly Pill[]; empty?: string; inspect: string };

  const ZONES: readonly Zone[] = [
    { key: "X — across", pills: [{ label: "substations.name", icon: Hash }], inspect: "analysis.placement" },
    { key: "Y — up", pills: [{ label: "sum of customerMinutes", icon: Sigma, on: true }, { label: "count of eventId", icon: Sigma }], inspect: "analysis.placement" },
    { key: "Filters", pills: [{ label: "eventDate ≥ 2026-01-01", icon: Filter }], empty: "drop a field to filter by it", inspect: "analysis.filter" },
    { key: "Sort", pills: [{ label: "sum of customerMinutes, high to low", icon: ArrowDownWideNarrow }], inspect: "analysis.sort" },
    { key: "Limit", pills: [{ label: "top 10", icon: Filter }], inspect: "analysis.limit" },
    { key: "Colour", pills: [], empty: "this chart doesn't need one — drop a field to split the bars", inspect: "analysis.chart" }
  ];

  const LIBRARY = [
    { name: "Outage minutes by substation", meta: "Bar · 6 of 41 rows", icon: ChartColumn },
    { name: "Cost per avoided minute", meta: "Bar · 41 rows", icon: ChartColumn },
    { name: "Events by month", meta: "Line · 24 rows", icon: Activity },
    { name: "Spend against authorization", meta: "Table · 4 rows", icon: Sheet }
  ];
</script>

{#if one}
  <ScreenSurface>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-h4 leading-h4 m-0 font-semibold">Outage minutes by substation</h1>
      <div class="flex items-center gap-2">
        <PanelChip tone="success">Saved</PanelChip>
        <PanelButton label="All analyses" onclick={() => (one = false)} />
      </div>
    </div>

    <div
      class="border-border-subtle bg-surface-panel rounded-panel flex flex-col gap-3 border p-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="text-body-lg font-medium">Customer-minutes by substation, 2026 storms</span>
        <div class="flex flex-wrap gap-1">
          {#each KINDS as kind (kind)}
            <button
              type="button"
              onclick={() => workbench.inspect("analysis.chart")}
              aria-current={kind === "Bar" ? "true" : undefined}
              class="text-caption border-border-subtle text-ink-secondary aria-[current]:border-active-border aria-[current]:bg-active-surface aria-[current]:text-active-text rounded-control cursor-pointer border bg-transparent px-1.5 py-0.5"
            >
              {kind}
            </button>
          {/each}
        </div>
      </div>

      <div class="flex h-50 items-end gap-3">
        {#each BARS as bar (bar.name)}
          <button
            type="button"
            onclick={() => workbench.inspect("analysis.mark")}
            class="flex h-full flex-1 cursor-pointer flex-col justify-end gap-1.5 border-none bg-transparent p-0"
          >
            <span
              class="rounded-t-sm {bar.selected ? 'bg-active-fill' : 'bg-interactive-fill'}"
              style="height: {bar.height}%"
            ></span>
            <span class="text-caption text-ink-muted truncate">{bar.name}</span>
          </button>
        {/each}
      </div>

      <div class="flex flex-wrap justify-between gap-2">
        <span class="text-caption text-ink-muted">
          Generated from current data — the result itself is not stored.
        </span>
        <span class="text-caption text-ink-muted tabular-nums">Showing 6 of 41 · limit 10</span>
      </div>
    </div>

    <!--
      Six drop zones. An empty one says what belongs in it rather than sitting
      blank, and every zone also has an Add menu and a keyboard path — nothing
      here is drag-only.
    -->
    <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr))">
      {#each ZONES as zone (zone.key)}
        <div
          class="border-border-strong rounded-panel bg-surface-elevated flex min-h-16 flex-col gap-2 border border-dashed p-3"
        >
          <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
            {zone.key}
          </span>
          <div class="flex flex-wrap items-center gap-1">
            {#each zone.pills as pill (pill.label)}
              {@const PillIcon = pill.icon}
              <button
                type="button"
                onclick={() => workbench.inspect(zone.inspect)}
                aria-current={pill.on ? "true" : undefined}
                class="text-caption border-border-subtle bg-surface-panel aria-[current]:border-active-border aria-[current]:bg-active-surface aria-[current]:text-active-text rounded-control inline-flex cursor-pointer items-center gap-1 border px-1.5 py-0.5"
              >
                <PillIcon size={11} aria-hidden="true" />
                {pill.label}
              </button>
            {/each}
            {#if zone.empty}
              <span class="text-caption text-ink-muted italic">{zone.empty}</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <ScreenBanner title="Two variables, no relationship" meta="subId → id">
      {#snippet actions()}
        <PanelButton label="Change the match" onclick={() => workbench.inspect("analysis.relationship")} />
      {/snippet}
      You dropped <b>substations.name</b> and <b>outageEvents.customerMinutes</b>.
      They line up on <b>subId → id</b>, which is what this chart is using. Change
      it, or pick a different pairing.
    </ScreenBanner>
  </ScreenSurface>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Analysis"
      about="Every chart built on this project's variables. One Analysis tab — which one you are on is view state."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (one = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New analysis
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters
      placeholder="Search analyses"
      matched={4}
      total={4}
      sort="recent"
      sorts={[
        { value: "recent", label: "Recently opened" },
        { value: "name", label: "Name" },
        { value: "kind", label: "Kind" }
      ]}
    >
      <PanelChip tone="active">All</PanelChip>
      <PanelChip>Charts</PanelChip>
      <PanelChip>Tables</PanelChip>
    </ScreenFilters>

    <ScreenCards>
      {#each LIBRARY as item (item.name)}
        <ScreenCard title={item.name} sub={item.meta} icon={item.icon} onselect={() => (one = true)}>
          {#snippet thumb()}
            <span
              class="border-border-subtle bg-surface-canvas rounded-control flex aspect-4/3 items-end gap-1.5 border p-3"
              aria-hidden="true"
            >
              {#each [38, 66, 92, 52] as height, index (index)}
                <span
                  class="flex-1 rounded-t-sm {index === 2 ? 'bg-active-fill' : 'bg-interactive-fill'}"
                  style="height: {height}%"
                ></span>
              {/each}
            </span>
          {/snippet}
        </ScreenCard>
      {/each}
    </ScreenCards>

    <p class="text-caption text-ink-muted m-0">
      Nothing about a result is stored. Opening one runs it again against the
      variables as they are now.
    </p>
  </ScreenSurface>
{/if}
