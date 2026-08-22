<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { PanelChoice } from "$lib/unique-components/panel";
  import {
    ScreenAction,
    ScreenCard,
    ScreenCards,
    ScreenEmpty,
    ScreenFilters,
    ScreenHeader,
    ScreenNote,
    ScreenSurface,
    ScreenThumb
  } from "$lib/unique-components/screen";
  import { Separator } from "$lib/simple-components/separator";
  import {
    templateKinds,
    templates,
    type LibraryTemplate,
    type TemplateTarget
  } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Templates — all templates: everything available here, as shapes.
   *
   * `docs/screen-panel-views/screens/templates/workspace-library.md` is the
   * specification. Four bands down one column, and the cards get two of them:
   * a template is recognised by its shape, so the grid is the region that takes
   * the height and the three around it are single bands.
   *
   * **Cards rather than a table**, because a list of template names is not a way
   * to find a template. The preview stands for the real body — the model has no
   * thumbnail field — which is what the note under the grid says out loud.
   *
   * **The two filter groups are separated on purpose.** Scope and target kind
   * are different questions, and a single run of seven chips reads as one axis
   * with seven answers.
   */
  let {
    onopen = () => {},
    onnew = () => {}
  }: {
    /** Enter the authoring state for one template. The screen state is the parent's. */
    onopen?: (templateId: string) => void;
    onnew?: () => void;
  } = $props();

  const all = $derived(templates().current);
  const kinds = $derived(templateKinds().current);

  let search = $state("");
  let scope = $state("all");
  let makes = $state("all");
  let order = $state("updated");

  const SCOPES = [
    { value: "all", label: "All" },
    { value: "Project", label: "Project" },
    { value: "Global", label: "Global" }
  ] as const;

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "makes", label: "Makes" }
  ] as const;

  /** The kind chips are the four things a template can make, from the door that names them. */
  const kindOptions = $derived([
    { value: "all", label: "All kinds" },
    ...kinds.map((kind) => ({ value: kind.makes, label: kind.makes }))
  ]);

  /** A page, a slide and a grid are different shapes, and the preview is the shape. */
  const RATIO: Record<TemplateTarget, string> = {
    Document: "4 / 3",
    "Slide deck": "16 / 9",
    Slide: "16 / 9",
    Spreadsheet: "1 / 1"
  };

  const shown = $derived.by(() => {
    const needle = search.trim().toLowerCase();
    const rows = all
      .filter((row: LibraryTemplate) => scope === "all" || row.scope === scope)
      .filter((row: LibraryTemplate) => makes === "all" || row.makes === makes)
      .filter((row: LibraryTemplate) => row.name.toLowerCase().includes(needle));
    if (order === "name")
      return [...rows].sort((a: LibraryTemplate, b: LibraryTemplate) => a.name.localeCompare(b.name));
    if (order === "makes")
      return [...rows].sort((a: LibraryTemplate, b: LibraryTemplate) =>
        a.makes.localeCompare(b.makes)
      );
    // The door answers most recently changed first, which is what "Updated" means here.
    return rows;
  });

  const sub = (row: LibraryTemplate): string =>
    `${row.makes} · ${row.scope} · ${row.variables} ${row.variables === 1 ? "variable" : "variables"}`;

  const isSelected = (id: string): boolean =>
    view.selection?.kind === "template" && view.selection.id === id;

  /** Selecting a template puts it in the lens; the lens is where Edit and Use are. */
  const select = (id: string) => {
    view.inspect("library.template", { kind: "template", id });
    onopen(id);
  };
</script>

<ScreenSurface>
  <div class="board">
    <div class="area-header">
      <ScreenHeader
        title="Templates"
        about="A real body with variables left open. Using one makes an independent copy — later edits to the template never reach it."
      >
        {#snippet actions()}
          <ScreenAction label="New template" icon={Plus} onclick={onnew} />
        {/snippet}
      </ScreenHeader>
    </div>

    <div class="area-filters">
      <ScreenFilters
        placeholder="Search templates"
        matched={shown.length}
        total={all.length}
        sorts={SORTS}
        bind:sort={order}
        bind:value={search}
      >
        <PanelChoice
          label="Scope"
          value={scope}
          options={SCOPES}
          flush
          onchange={(next: string) => (scope = next)}
        />
        <Separator orientation="vertical" class="h-5" />
        <PanelChoice
          label="Makes"
          value={makes}
          options={kindOptions}
          flush
          onchange={(next: string) => (makes = next)}
        />
      </ScreenFilters>
    </div>

    <div class="area-templates min-h-0">
      {#if shown.length === 0}
        <ScreenEmpty
          kind="no-matches"
          title="No template matches"
          onclear={() => {
            search = "";
            scope = "all";
            makes = "all";
          }}
        >
          Nothing in this project or available everywhere is named that, or makes that.
        </ScreenEmpty>
      {:else}
        <ScreenCards>
          {#each shown as row (row.id)}
            <ScreenCard
              title={row.name}
              sub={sub(row)}
              selected={isSelected(row.id)}
              onselect={() => select(row.id)}
            >
              {#snippet thumb()}
                <!--
                  The bars stand for the body and the tinted ones for its
                  openings. How many, not where: nothing in a body records which
                  variable it stands for, so a preview can count the openings and
                  cannot place them.
                -->
                <ScreenThumb ratio={RATIO[row.makes]} lines={6} variables={Math.min(row.variables, 6)} />
              {/snippet}
            </ScreenCard>
          {/each}
        </ScreenCards>
      {/if}
    </div>

    <div class="area-note">
      <ScreenNote meta={`${shown.length} of ${all.length}`}>
        Previews are rendered from the real body. The model has no thumbnail, tag, category,
        favourite or usage count, so the library does not pretend those exist.
      </ScreenNote>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * The specification's layout table, as `grid-template-areas`. One track: a
   * card grid already wraps to the width it is given, so there is nothing for a
   * second column to hold. `templates` is written twice because that is how the
   * table gives the grid its height.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 4);
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "filters"
      "templates"
      "templates"
      "note";
    align-content: start;
  }

  .area-header {
    grid-area: header;
  }
  .area-filters {
    grid-area: filters;
  }
  .area-templates {
    grid-area: templates;
  }
  .area-note {
    grid-area: note;
  }

  /*
    Already one column, so the narrow case only closes the gaps: the cards drop
    to a single column on their own, which is `ScreenCards`' decision to make.
  */
  @media (max-width: 60rem) {
    .board {
      gap: calc(var(--token-spacing-unit) * 3);
    }
  }
</style>
