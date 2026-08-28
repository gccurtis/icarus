<script lang="ts">
  import Blocks from "@lucide/svelte/icons/blocks";
  import FileIcon from "@lucide/svelte/icons/file";
  import FileText from "@lucide/svelte/icons/file-text";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Plug from "@lucide/svelte/icons/plug";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Table from "@lucide/svelte/icons/table";
  import Telescope from "@lucide/svelte/icons/telescope";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$authored-components/panel";
  import type { Resource, ResourceKind } from "$capabilities/cast";
  import { health, resources } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * Resources — everything in the project, grouped by what it is.
   *
   * `docs/screen-panel-views/context/project/resources.md` is the specification.
   * A row opens the thing in the inspector rather than navigating away, which is
   * what lets you look through several without losing your place.
   *
   * **Files and connectors are one group** because a connector is mostly
   * interesting as the source of its files, and a row that nothing can be read
   * out of says so on its second line.
   */
  const view = viewState();

  const all = $derived(resources().current);
  const problems = $derived(health().current);

  let search = $state("");

  /** The five groups the specification names, and what falls outside them. */
  const GROUPED: readonly ResourceKind[] = [
    "document",
    "slides",
    "spreadsheet",
    "finding",
    "file"
  ];

  const ICON = {
    document: FileText,
    slides: Presentation,
    spreadsheet: Sheet,
    research: Telescope,
    analysis: Table,
    file: FileIcon,
    finding: Lightbulb,
    connector: Plug,
    context: Blocks,
    template: FileText
  };

  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());

  const covered = $derived(all.filter((resource) => GROUPED.includes(resource.kind)));
  const shown = $derived(covered.filter((resource) => matches(resource.name)));

  const byKind = (kind: ResourceKind) => shown.filter((resource) => resource.kind === kind);

  /** Connectors are actors as well as sources, so they are named, not numbered. */
  const connectors = $derived(
    problems.filter((issue) => issue.group === "Connectors" && matches(issue.title))
  );

  /** What stops a file being read out of, when something does. */
  const blocked = (name: string) =>
    problems.find((issue) => issue.group === "Extraction" && issue.title === name)?.detail;

  const outside = $derived(all.filter((resource) => !GROUPED.includes(resource.kind)));

  const openResource = (resource: Resource) => {
    if (resource.kind === "file") {
      view.inspect("project.file", { kind: "file", id: resource.id });
      return;
    }

    view.inspect("project.resource", { kind: "resource", id: resource.id });
  };
</script>

{#snippet items(rows: readonly Resource[])}
  {#each rows as resource (resource.id)}
    <PanelRow
      title={resource.name}
      sub={blocked(resource.name)}
      meta={resource.updated}
      icon={ICON[resource.kind]}
      tone={blocked(resource.name) === undefined ? "default" : "attention"}
      onselect={() => openResource(resource)}
    />
  {/each}
{/snippet}

<Panel title="Resources">
  <!--
    One field over every group, so a name is looked for without first deciding
    which of five things it is.
  -->
  <PanelSearch
    placeholder="Search resources"
    matched={shown.length + connectors.length}
    total={covered.length + problems.filter((issue) => issue.group === "Connectors").length}
    empty="Nothing in the project matches."
    bind:value={search}
    flush
  >
    <PanelSection title="Documents" count={byKind("document").length} flush>
      {@render items(byKind("document"))}
    </PanelSection>

    <PanelSection title="Slide decks" count={byKind("slides").length} flush>
      {@render items(byKind("slides"))}
    </PanelSection>

    <PanelSection title="Spreadsheets" count={byKind("spreadsheet").length} flush>
      {@render items(byKind("spreadsheet"))}
    </PanelSection>

    <!--
      Findings are resources — retrievable anywhere in the project, exactly like a
      document — but they are read through what cites them far more often than
      they are browsed, so the group arrives shut.
    -->
    <PanelSection title="Findings" count={byKind("finding").length} open={false} flush>
      {@render items(byKind("finding"))}
    </PanelSection>

    <PanelSection
      title="Files and connectors"
      count={byKind("file").length + connectors.length}
      flush
    >
      {#each connectors as connector (connector.id)}
        <PanelRow
          title={connector.title}
          sub={connector.detail}
          icon={Plug}
          tone={connector.tone}
          onselect={() =>
            view.inspect("project.connector", {
              kind: "connector",
              id: connector.id
            })}
        />
      {/each}

      {@render items(byKind("file"))}
    </PanelSection>

    {#if outside.length > 0}
      <PanelNote tone="gap">
        {outside.length} resources are of kinds this view has no group for, and are not listed.
      </PanelNote>
    {/if}
  </PanelSearch>
</Panel>
