<script lang="ts">
  import {
    Panel,
    PanelSearch,
    PanelSelect,
    PanelTimeline
  } from "$authored-components/panel";

  const noop = () => undefined;

  let { stress = false }: { stress?: boolean } = $props();

  const ENTRIES = [
    {
      id: "activity:1",
      what: "Edited: Winter readiness brief",
      detail: "Mira Okonkwo",
      time: "12m",
      daysAgo: 0,
      onselect: noop
    },
    {
      id: "activity:2",
      what: "Edited: Outage minutes by substation",
      detail: "Tomás Lindqvist",
      time: "38m",
      daysAgo: 0,
      onselect: noop
    },
    {
      id: "activity:7",
      what: "Synced: SCADA outage log",
      detail: "Google Drive",
      time: "1h",
      daysAgo: 0,
      onselect: noop
    },
    {
      id: "activity:8",
      what: "Added a comment: Substation 14 incident write-up",
      detail: "Priya Raghunathan",
      time: "1d",
      daysAgo: 1,
      onselect: noop
    },
    {
      id: "activity:9",
      what: "Recalculated: Hardening cost model",
      detail: "Grid Analyst",
      time: "9d",
      daysAgo: 9,
      tone: "intelligence" as const,
      onselect: noop
    }
  ] as const;

  const STRESS_ENTRY = {
    id: "activity:stress",
    what:
      "Started a research question: How should the resilience team reconcile customer-minutes lost across the northern transmission corridor when the source assumptions, operating windows, and restoration scenarios all disagree?",
    detail:
      "Alexandria-Cassandra Montgomery · Winter-readiness-evidence-reconciliation-and-operating-assumptions",
    time: "29d",
    daysAgo: 29,
    tone: "intelligence" as const,
    onselect: noop
  } as const;

  let search = $state("");
  let window = $state("all");

  const withinWindow = (daysAgo: number): boolean =>
    window === "all" ||
    (window === "today" && daysAgo === 0) ||
    (window === "week" && daysAgo <= 7) ||
    (window === "month" && daysAgo <= 30);
  const results = $derived(
    (stress ? [...ENTRIES, STRESS_ENTRY] : ENTRIES).filter((entry) => {
      const needle = search.trim().toLocaleLowerCase();
      return withinWindow(entry.daysAgo) &&
        `${entry.what} ${"detail" in entry ? entry.detail : ""}`.toLocaleLowerCase().includes(needle);
    })
  );
</script>

<Panel title="History">
  <div class="flex flex-col pt-1">
    <div class="border-border-subtle bg-surface-panel-hover mx-3 my-1.5 flex flex-col gap-1 rounded-control border p-2">
      <span class="text-caption text-ink-secondary font-semibold tracking-wide uppercase">Filter</span>
      <PanelSelect
        label="History period"
        value={window}
        options={[
          { value: "all", label: "All time" },
          { value: "today", label: "Today" },
          { value: "week", label: "Past 7 days" },
          { value: "month", label: "Past 30 days" }
        ]}
        onchange={(next) => (window = next)}
      />
    </div>

    <PanelSearch placeholder="Search history" bind:value={search} flush>
      <div class="border-border-subtle mx-3 flex items-center border-t pt-2 pb-1.5">
        <h3 class="text-caption text-ink-secondary m-0 font-semibold tracking-wide uppercase">
          Results
        </h3>
        <span class="text-caption text-ink-secondary bg-surface-panel-hover ms-auto rounded-control px-1.5 py-0.5 font-medium tabular-nums">
          {results.length}
        </span>
      </div>
      <PanelTimeline
        entries={results}
        label="Project history results"
        interactiveRows
        compact
        empty="Nothing in project history matches."
      />
    </PanelSearch>
  </div>
</Panel>
