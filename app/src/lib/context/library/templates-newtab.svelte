<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Presentation from "@lucide/svelte/icons/presentation";
  import TableIcon from "@lucide/svelte/icons/table";

  import { Panel, PanelButton, PanelRow, PanelSearch, PanelSection } from "$lib/unique-components/panel";
  import { templates, type LibraryTemplate } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Starting from something rather than from nothing.
   *
   * `docs/screen-panel-views/context/library/templates-newtab.md` is the
   * specification. Grouped by what the template makes, matching the three pills
   * in the centre; scope and variable count ride on the row because both change
   * what pressing one will do.
   *
   * **Slide templates are not here.** A slide template makes one slide, which is
   * not an editor this tab can open, so it would be a row that cannot answer the
   * only question this tab asks.
   *
   * The specification puts **Open Templates** at the foot. A panel has no footer
   * — every control that ended up in one was buried under a list of unbounded
   * length — so it is in the action row, and it is the parent's to perform: this
   * panel cannot reach another screen.
   */
  let { onopentemplates }: { onopentemplates?: () => void } = $props();

  const all = $derived(templates().current);

  let search = $state("");

  const MAKES = { Document: FileText, "Slide deck": Presentation, Spreadsheet: TableIcon };

  /** The three the centre offers as pills, in the centre's order. */
  const GROUPS = ["Document", "Slide deck", "Spreadsheet"] as const;

  const shown = $derived(
    all
      .filter((row) => row.makes !== "Slide")
      .filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const of = (makes: keyof typeof MAKES) => shown.filter((row) => row.makes === makes);

  /** "Project · 4 variables", and the scope alone when it asks for nothing. */
  const says = (row: LibraryTemplate) =>
    row.variables === 0
      ? row.scope
      : `${row.scope} · ${row.variables} ${row.variables === 1 ? "variable" : "variables"}`;

  const start = (id: string) =>
    mockWorkbench.inspect("library.start-from-template", { kind: "template", id });
</script>

<Panel title="Templates">
  {#snippet actions()}
    <PanelButton
      label="Open Templates"
      icon={LayoutTemplate}
      disabled={onopentemplates === undefined}
      title="Every template, in the Templates screen"
      onclick={onopentemplates}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search templates"
    matched={shown.length}
    total={all.filter((row) => row.makes !== "Slide").length}
    bind:value={search}
    flush
  >
    {#each GROUPS as makes (makes)}
      <PanelSection title={makes} count={of(makes).length} flush>
        {#each of(makes) as row (row.id)}
          <PanelRow
            title={row.name}
            sub={says(row)}
            icon={MAKES[makes]}
            onselect={() => start(row.id)}
          />
        {/each}
      </PanelSection>
    {/each}
  </PanelSearch>
</Panel>
