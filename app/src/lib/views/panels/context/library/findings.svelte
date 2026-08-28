<script lang="ts">
  import Lightbulb from "@lucide/svelte/icons/lightbulb";

  import { Panel, PanelRow, PanelSearch, PanelSection } from "$components/authored/panel";
  import { findings } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Everything this project has accepted, in one list.
   *
   * `docs/screen-panel-views/context/library/findings.md` is the specification.
   * A finding is a resource — retrievable anywhere in the project — which is why
   * this list exists at all rather than living as a detail inside each thread.
   *
   * There is no action row: nothing here is created, and a finding is accepted
   * in the thread that proposed it. Each row says where it came from and, when a
   * bearing exists, what it bears on, because a conclusion with no origin is a
   * claim nobody can check.
   */
  const all = $derived(findings().current);

  let search = $state("");

  const shown = $derived(
    all.filter((row) => row.title.toLowerCase().includes(search.trim().toLowerCase()))
  );
</script>

<Panel title="Findings">
  <PanelSearch
    placeholder="Search findings"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Accepted in this project" count={shown.length} flush>
      {#each shown as row (row.id)}
        <PanelRow
          title={row.title}
          sub={row.bearsOn === undefined
            ? `From ${row.from}`
            : `From ${row.from} · bears on ${row.bearsOn}`}
          meta={row.age}
          icon={Lightbulb}
          onselect={() =>
            view.inspect("research.accepted-finding", { kind: "finding", id: row.id })}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
