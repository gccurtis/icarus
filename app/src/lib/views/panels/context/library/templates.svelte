<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import FileText from "@lucide/svelte/icons/file-text";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import RectangleHorizontal from "@lucide/svelte/icons/rectangle-horizontal";
  import SquarePen from "@lucide/svelte/icons/square-pen";
  import TableIcon from "@lucide/svelte/icons/table";

  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$authored-components/panel";
  import { templates, type LibraryTemplate } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Every template available here, by scope.
   *
   * `docs/screen-panel-views/context/library/templates.md` is the specification.
   * Grouped by scope rather than by kind because scope decides what you may do
   * with one, and kind is already on the row.
   *
   * **Use is disabled on any template that has variables.** Nothing in a body
   * records which variable it stands for, so a supplied value has nowhere to go.
   * The button says that on hover rather than accepting the press and producing a
   * result with the openings still in it.
   */
  const all = $derived(templates().current);

  let search = $state("");
  let selectedId = $state<string | undefined>(undefined);

  const MAKES = {
    Document: FileText,
    "Slide deck": Presentation,
    Slide: RectangleHorizontal,
    Spreadsheet: TableIcon
  };

  const shown = $derived(
    all.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const project = $derived(shown.filter((row) => row.scope === "Project"));
  const shared = $derived(shown.filter((row) => row.scope === "Shared"));
  const personal = $derived(shown.filter((row) => row.scope === "Personal"));

  const selected = $derived(all.find((row) => row.id === selectedId));

  /** "Document · 4 variables", and nothing after the kind when it asks for none. */
  const says = (row: LibraryTemplate) =>
    row.variables === 0
      ? row.makes
      : `${row.makes} · ${row.variables} ${row.variables === 1 ? "variable" : "variables"}`;

  const choose = (id: string) => {
    selectedId = id;
    view.inspect("library.template", { kind: "template", id });
  };
</script>

<Panel title="Library">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      onclick={() => view.inspect("library.template", { kind: "template", id: "new" })}
    />
    <PanelButton
      label="Edit"
      icon={SquarePen}
      disabled={selected === undefined}
      title={selected === undefined ? "Choose a template first" : "Author the chosen template"}
      onclick={() =>
        selected &&
        view.inspect("library.body-entity", { kind: "template", id: selected.id })}
    />
    <PanelButton
      label="Use"
      icon={Play}
      disabled={selected === undefined || selected.variables > 0}
      title={selected === undefined
        ? "Choose a template first"
        : selected.variables > 0
          ? "Nothing in a body records which variable it stands for"
          : "Make something from the chosen template"}
      onclick={() =>
        selected &&
        view.inspect("library.use-template", { kind: "template", id: selected.id })}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={selected === undefined}
      title={selected === undefined ? "Choose a template first" : "Copy the chosen template"}
      onclick={() =>
        selected &&
        view.inspect("library.template", { kind: "template", id: selected.id })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search templates"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Project" count={project.length} flush>
      {#each project as row (row.id)}
        <PanelRow
          title={row.name}
          sub={says(row)}
          meta={row.updated}
          icon={MAKES[row.makes]}
          selected={row.id === selectedId}
          onselect={() => choose(row.id)}
        />
      {/each}
    </PanelSection>

    <!--
      Copying one of these into project scope makes a second template. There is
      no shared ownership across the boundary, so the two diverge from that
      moment — which is why these are separate sections rather than a badge.
    -->
    <PanelSection title="Shared" count={shared.length} flush>
      {#each shared as row (row.id)}
        <PanelRow
          title={row.name}
          sub={says(row)}
          meta={row.updated}
          icon={MAKES[row.makes]}
          selected={row.id === selectedId}
          onselect={() => choose(row.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Personal" count={personal.length} flush>
      {#each personal as row (row.id)}
        <PanelRow
          title={row.name}
          sub={says(row)}
          meta={row.updated}
          icon={MAKES[row.makes]}
          selected={row.id === selectedId}
          onselect={() => choose(row.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
