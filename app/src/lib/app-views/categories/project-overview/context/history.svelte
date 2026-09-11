<script lang="ts">
  import {
    Panel,
    PanelBanner,
    PanelSearch,
    PanelSelect,
    PanelSkeleton,
    PanelTimeline
  } from "$authored-components/panel";
  import { workspaceState } from "$model/client/workspace-state";
  import { followsHistoryFilter } from "$app-views/categories/project-overview/procedures/effects/follows-history-filter.svelte";
  import { ticksTheClock } from "$app-views/categories/project-overview/procedures/effects/ticks-the-clock.svelte";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  const DAY = 24 * 60 * 60 * 1_000;
  const WINDOWS = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "week", label: "Past 7 days" },
    { value: "month", label: "Past 30 days" }
  ] as const;

  const view = workspaceState();
  const clock = ticksTheClock();
  let search = $state("");
  let window = $state("all");
  const now = $derived(clock.current);

  const startOfDay = (at: number): number => {
    const date = new Date(at);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };

  const sinceWindow = $derived(
    window === "today"
      ? startOfDay(now)
      : window === "week"
        ? now - 7 * DAY
        : window === "month"
          ? now - 30 * DAY
          : null
  );
  const query = followsHistoryFilter(() => search, () => sinceWindow);
  const answer = $derived(query.current);
  const history = $derived(answer.ready ? answer.current : undefined);

  const lineOf = (entry: NonNullable<typeof history>["entries"][number]) => ({
    id: entry.id,
    what: `${entry.what}: ${entry.target.label}`,
    detail: entry.actorLabel,
    time: shortSince(entry.at, now),
    tone: entry.actor?.kind === "agent" ? ("intelligence" as const) : undefined,
    onselect: () =>
      view.inspect("project-overview.activity", { kind: "activity", id: entry.id })
  });

  const results = $derived((history?.entries ?? []).map(lineOf));
</script>

<!-- Activity is the project record. Directed comments remain in the centre's Mentions feed. -->
<Panel title="History">
  <div class="flex flex-col pt-1">
    <div class="mx-3 my-1.5">
      <PanelSelect
        label="History period"
        value={window}
        options={WINDOWS}
        onchange={(next) => (window = next)}
      />
    </div>

    <PanelSearch placeholder="Search history" bind:value={search} flush>
      <div class="border-border-subtle mx-3 flex items-center border-t pt-2 pb-1.5">
        <h3 class="text-caption text-ink-secondary m-0 font-semibold tracking-wide uppercase">
          Results
        </h3>
        {#if history !== undefined}
          <span class="text-caption text-ink-secondary bg-surface-panel-hover ms-auto rounded-control px-1.5 py-0.5 font-medium tabular-nums">
            {history.matched}
          </span>
        {/if}
      </div>

      {#if answer.error}
        <PanelBanner title="Project history unavailable" tone="attention">
          {answer.error instanceof Error ? answer.error.message : String(answer.error)}
        </PanelBanner>
      {:else if !answer.ready}
        <PanelSkeleton count={5} />
      {:else}
        <PanelTimeline
          entries={results}
          label="Project history results"
          interactiveRows
          compact
          empty="Nothing in project history matches."
        />
      {/if}
    </PanelSearch>
  </div>
</Panel>
