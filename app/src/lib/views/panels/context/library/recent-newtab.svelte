<script lang="ts">
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import File from "@lucide/svelte/icons/file";
  import FileText from "@lucide/svelte/icons/file-text";
  import Layers from "@lucide/svelte/icons/layers";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import MessageCircleQuestionMark from "@lucide/svelte/icons/message-circle-question-mark";
  import Plug from "@lucide/svelte/icons/plug";
  import Presentation from "@lucide/svelte/icons/presentation";
  import TableIcon from "@lucide/svelte/icons/table";

  import { Panel, PanelRow, PanelSearch, PanelSection } from "$authored-components/panel";
  import type { ResourceKind } from "$capabilities/cast";
  import { kindLabel, recents, type RecentRow } from "$capabilities/library";
  import { resources } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What you had open lately, and what changed lately.
   *
   * `docs/screen-panel-views/context/library/recent-newtab.md` is the
   * specification. Grouped by day, and every kind appears — Research threads
   * included — because "what was I doing" does not respect the difference between
   * a resource and a thread.
   *
   * This is two lists merged: what you opened, which is local tab history, and
   * what changed, which is `updatedAt`. A document you have never opened can
   * therefore appear here, so every row says which of the two put it there.
   *
   * The field searches the whole project rather than only these rows, so a query
   * adds one band under *Earlier* for what it found outside them. The layout in
   * the specification is the resting state.
   */
  const recent = $derived(recents().current);
  const everything = $derived(resources().current);

  let search = $state("");

  const query = $derived(search.trim().toLowerCase());
  const matches = (name: string) => name.toLowerCase().includes(query);

  const shown = $derived(recent.filter((row) => matches(row.name)));

  const on = (day: RecentRow["day"]) => shown.filter((row) => row.day === day);

  /** Only while searching, and never something already shown above. */
  const elsewhere = $derived(
    query === ""
      ? []
      : everything.filter(
          (row) => matches(row.name) && !recent.some((seen) => seen.id === row.id)
        )
  );

  const KIND: Record<ResourceKind, typeof FileText> = {
    document: FileText,
    slides: Presentation,
    spreadsheet: TableIcon,
    research: MessageCircleQuestionMark,
    analysis: ChartColumn,
    file: File,
    finding: Lightbulb,
    connector: Plug,
    context: Layers,
    template: LayoutTemplate
  };

  const DAYS = ["Today", "Yesterday", "Earlier"] as const;

  const open = (id: string) =>
    view.inspect("library.recent-item", { kind: "resource", id });
</script>

<Panel title="Recent">
  <PanelSearch
    placeholder="Search this project"
    matched={query === "" ? undefined : shown.length + elsewhere.length}
    total={query === "" ? undefined : recent.length + elsewhere.length}
    empty="Nothing in the project matches."
    bind:value={search}
    flush
  >
    {#each DAYS as day (day)}
      <PanelSection title={day} count={on(day).length} flush>
        {#each on(day) as row (row.id)}
          <PanelRow
            title={row.name}
            sub={row.why === "You opened it" ? row.why : `${row.why} — ${row.updatedBy}`}
            meta={row.age}
            icon={KIND[row.kind]}
            onselect={() => open(row.id)}
          />
        {/each}
      </PanelSection>
    {/each}

    {#if elsewhere.length > 0}
      <PanelSection title="Elsewhere in the project" count={elsewhere.length} flush>
        {#each elsewhere as row (row.id)}
          <PanelRow
            title={row.name}
            sub={kindLabel(row.kind)}
            meta={row.updated}
            icon={KIND[row.kind]}
            onselect={() => open(row.id)}
          />
        {/each}
      </PanelSection>
    {/if}
  </PanelSearch>
</Panel>
