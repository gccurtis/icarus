<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { PanelChoice } from "$lib/unique-components/panel";
  import {
    ScreenAction,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenNote,
    ScreenRow,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import { acceptedIn, threadsIn, type ResearchThread } from "$mock-capabilities/research";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Research — all threads: every line of enquiry in the project, as one table.
   *
   * `docs/screen-panel-views/screens/research/workspace-all-threads.md` is the
   * specification. Four bands down one column — header, filters, the table, a
   * note — and the table is given three of the layout table's bands to the one
   * each the others get, which is why it is the region that takes the height.
   *
   * **Opening a thread does not mint a tab.** There is one Research tab and this
   * is how you get between the threads in it, which is the rule the subtitle
   * carries and the reason `onopen` is a callback rather than a link.
   *
   * **Findings is the column that says whether a thread went anywhere**, and it
   * is matched-of-proposed rather than a single figure: turns alone measure
   * effort. The proposed half is dropped when it is zero rather than printed as
   * "0 proposed", which would read as a result.
   */
  let {
    onopen = () => {},
    onnewthread = () => {}
  }: {
    /** Bring one thread to the centre. The screen state is the parent's to hold. */
    onopen?: (threadId: string) => void;
    onnewthread?: () => void;
  } = $props();

  const all = $derived(threadsIn(view.project).current);

  let search = $state("");
  let mode = $state("all");
  let order = $state("recent");

  /** The three jobs, worded as the specification's chips word them. */
  const MODES = [
    { value: "all", label: "All" },
    { value: "Question", label: "Questions" },
    { value: "Hypothesis", label: "Hypotheses" },
    { value: "Discover", label: "Open-ended" }
  ] as const;

  const SORTS = [
    { value: "recent", label: "Last asked" },
    { value: "findings", label: "Findings" },
    { value: "turns", label: "Turns" }
  ] as const;

  /** The search runs over threads *and* their findings: a thread is often remembered by what it produced. */
  const matches = (row: ResearchThread, needle: string): boolean =>
    needle === "" ||
    row.title.toLowerCase().includes(needle) ||
    acceptedIn(row.id).current.some((found) => found.title.toLowerCase().includes(needle));

  const shown = $derived.by(() => {
    const needle = search.trim().toLowerCase();
    const rows = all
      .filter((row: ResearchThread) => mode === "all" || row.mode === mode)
      .filter((row: ResearchThread) => matches(row, needle));
    if (order === "findings")
      return [...rows].sort((a: ResearchThread, b: ResearchThread) => b.accepted - a.accepted);
    if (order === "turns")
      return [...rows].sort((a: ResearchThread, b: ResearchThread) => b.turns - a.turns);
    // The door answers newest first, which is what "Last asked" means here.
    return rows;
  });

  const findingsLabel = (row: ResearchThread): string =>
    row.proposed > 0 ? `${row.accepted} accepted · ${row.proposed} proposed` : `${row.accepted} accepted`;

  const isSelected = (id: string): boolean =>
    view.selection?.kind === "thread" && view.selection.id === id;

  /** Opening a thread also puts it in the inspector: what you opened is what you are looking at. */
  const open = (id: string) => {
    view.inspect("research.thread", { kind: "thread", id });
    onopen(id);
  };
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Research"
        about="Every line of enquiry in this project. Opening one brings it to the centre — there is one Research tab, not one per thread."
      >
        {#snippet actions()}
          <ScreenAction label="New thread" icon={Plus} onclick={onnewthread} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search threads and findings"
        matched={shown.length}
        total={all.length}
        sorts={SORTS}
        bind:sort={order}
        bind:value={search}
      >
        <PanelChoice
          label="Job"
          value={mode}
          options={MODES}
          flush
          onchange={(next: string) => (mode = next)}
        />
      </ScreenFilters>
    </div>

    <div class="area-threads min-h-0">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No thread matches"
          onclear={() => {
            search = "";
            mode = "all";
          }}
        >
          Nothing here has that in its title, and no finding accepted in this project does either.
        </ScreenEmpty>
      {:else}
        <ScreenTable columns={["Thread", "Job", "Turns", "Findings", "Last asked"]}>
          {#each shown as row (row.id)}
            <ScreenRow selected={isSelected(row.id)}>
              <ScreenCell name={row.title} onselect={() => open(row.id)} />
              <ScreenCell>{row.job}</ScreenCell>
              <ScreenCell num>{row.turns}</ScreenCell>
              <ScreenCell>{findingsLabel(row)}</ScreenCell>
              <ScreenCell num>{row.lastAsked}</ScreenCell>
            </ScreenRow>
          {/each}
        </ScreenTable>
      {/if}
    </div>

    <div class="area-note">
      <ScreenNote>
        A thread has one job, chosen when it starts — look around, answer one question, or test one
        idea. That is what keeps an enquiry from becoming a chat room.
      </ScreenNote>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. One track: every
   * band here is the full width because a table of threads has nothing to sit
   * beside. `threads` is written three times because that is how the table
   * gives it its height — three bands to one each for the others.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "threads"
      "threads"
      "threads"
      "note";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-threads {
    grid-area: threads;
  }
  .area-note {
    grid-area: note;
  }

  /*
    Already one column, so the narrow case only closes the gaps: at this width
    the bands are reading one after another rather than being scanned.
  */
  @media (max-width: 60rem) {
    .board {
      gap: calc(var(--token-spacing-unit) * 3);
    }
  }
</style>
