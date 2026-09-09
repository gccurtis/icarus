<script lang="ts">
  import { onMount } from "svelte";

  import {
    Panel,
    PanelBanner,
    PanelSearch,
    PanelSelect,
    PanelSkeleton,
    PanelTimeline
  } from "$authored-components/panel";
  import { readProjectHistory } from "$capabilities/project/index.remote";
  import { workspaceState } from "$model/client/workspace-state";
  import { activityLabel } from "$app-views/categories/project-overview/procedures/activity-label";
  import { shortSince } from "$app-views/categories/project-overview/procedures/rows";

  const DAY = 24 * 60 * 60 * 1_000;
  const WINDOWS = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "week", label: "Past 7 days" },
    { value: "month", label: "Past 30 days" }
  ] as const;

  const view = workspaceState();
  let search = $state("");
  let window = $state("all");
  let now = $state(Date.now());

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

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
  // Keep the proxy in component state. A derived that owns a succession of
  // query proxies can release the previous query root while downstream
  // derivations are still settling, which Svelte correctly reports as an inert
  // derived read during fast search input.
  let answer = $state.raw(
    readProjectHistory({ search: "", since: null, before: null, limit: 50 })
  );
  $effect(() => {
    answer = readProjectHistory({ search, since: sinceWindow, before: null, limit: 50 });
  });
  const history = $derived(answer.ready ? answer.current : undefined);

  const lineOf = (entry: NonNullable<typeof history>["entries"][number]) => ({
    id: entry.id,
    what: `${activityLabel(entry.verb)}: ${entry.target.label}`,
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
    <div class="border-border-subtle bg-surface-panel-hover mx-3 my-1.5 flex flex-col gap-1 rounded-control border p-2">
      <span class="text-caption text-ink-secondary font-semibold tracking-wide uppercase">Filter</span>
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
