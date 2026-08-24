<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { templates, type TemplateRow } from "$mock-capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * Templates — what is available here, grouped by what it makes.
   *
   * `docs/screen-panel-views/context/project/templates.md` is the specification.
   * Grouped by target because the first question about a template is what comes
   * out of it; scope and variable count sit on the row because those two decide
   * whether it can be used at all.
   *
   * **A row opens a template and cannot instantiate one.** No body entity carries
   * a variable key yet, so there is no Use control here rather than one that
   * would produce a document with the keys still in it.
   */
  let { onopen }: { onopen?: () => void } = $props();

  const view = viewState();

  const all = $derived(templates().current);

  let search = $state("");

  const ICON = { Document: FileText, "Slide deck": Presentation, Spreadsheet: Sheet };

  const shown = $derived(
    all.filter((template) => template.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const making = (makes: TemplateRow["makes"]) =>
    shown.filter((template) => template.makes === makes);

  /** Scope and variables read as one line, because they are one decision. */
  const about = (template: TemplateRow) =>
    template.variables === 0
      ? template.scope
      : `${template.scope} · ${template.variables} variables`;

  /** A template that makes a single slide has no group here yet. */
  const ungrouped = $derived(all.filter((template) => template.makes === "Slide"));
</script>

{#snippet group(makes: "Document" | "Slide deck" | "Spreadsheet", title: string)}
  <PanelSection {title} count={making(makes).length} flush>
    {#each making(makes) as template (template.id)}
      <PanelRow
        title={template.name}
        sub={about(template)}
        icon={ICON[makes]}
        onselect={() =>
          view.inspect("library.template", { kind: "template", id: template.id })}
      />
    {/each}
  </PanelSection>
{/snippet}

<Panel title="Templates">
  {#snippet actions()}
    <PanelButton
      label="Open Templates"
      icon={ArrowRight}
      disabled={onopen === undefined}
      title="Every template, on the Templates screen"
      onclick={onopen}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search templates"
    matched={shown.length}
    total={all.length}
    empty="No template matches."
    bind:value={search}
    flush
  >
    {@render group("Document", "Documents")}
    {@render group("Slide deck", "Slide decks")}
    {@render group("Spreadsheet", "Spreadsheets")}

    {#if ungrouped.length > 0}
      <PanelNote tone="gap">
        {ungrouped.length} of these make a single slide, which has no group here yet.
      </PanelNote>
    {/if}
  </PanelSearch>
</Panel>
