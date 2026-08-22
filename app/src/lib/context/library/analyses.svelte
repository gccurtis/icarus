<script lang="ts">
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Plus from "@lucide/svelte/icons/plus";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { analyses } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Every chart built on this project's variables.
   *
   * `docs/screen-panel-views/context/library/analyses.md` is the specification.
   * The last-run time is said as "run 3 days ago" rather than as a bare date,
   * because nothing about a result is stored: the sentence is about an artefact
   * that no longer exists, and wording it as an age is what keeps it from
   * reading as a link to one.
   *
   * **Open** and **Duplicate** act on a row, so they are dead until one is
   * chosen. A control that looks pressable and silently does nothing is worse
   * than one that says it is waiting for a selection.
   */
  const all = $derived(analyses().current);

  let search = $state("");
  let selectedId = $state<string | undefined>(undefined);

  const CHART = { Bar: ChartColumn, Line: ChartLine, Table: TableIcon, Area: ChartArea };

  const shown = $derived(
    all.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const open = (id: string) => {
    selectedId = id;
    view.inspect("analysis.analysis", { kind: "analysis", id });
  };
</script>

<Panel title="Analyses">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      onclick={() => view.inspect("analysis.analysis", { kind: "analysis", id: "new" })}
    />
    <PanelButton
      label="Open"
      icon={FolderOpen}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose an analysis first" : "Open the chosen analysis"}
      onclick={() => selectedId && open(selectedId)}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose an analysis first" : "Copy the chosen analysis"}
      onclick={() =>
        selectedId &&
        view.inspect("analysis.analysis", { kind: "analysis", id: selectedId })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search analyses"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="In this project" count={shown.length} flush>
      {#each shown as row (row.id)}
        <PanelRow
          title={row.name}
          sub="{row.chart} · run {row.ran}"
          icon={CHART[row.chart]}
          selected={row.id === selectedId}
          onselect={() => open(row.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
