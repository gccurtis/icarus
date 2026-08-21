<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Layers from "@lucide/svelte/icons/layers";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { contexts } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Every saved scope in the project.
   *
   * `docs/screen-panel-views/context/library/contexts.md` is the specification.
   * A Context is a rule rather than a list, so the count beside each one is
   * resolved now and not stored. Zero is therefore a real answer, and the row
   * says "matches nothing" out loud: a bare 0 beside a rule reads as a count
   * that has not loaded yet.
   */
  const all = $derived(contexts().current);

  let search = $state("");
  let selectedId = $state<string | undefined>(undefined);

  const shown = $derived(
    all.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const open = (id: string) => {
    selectedId = id;
    mockWorkbench.inspect("scope.context", { kind: "context", id });
  };
</script>

<Panel title="Contexts">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      onclick={() => mockWorkbench.inspect("scope.context", { kind: "context", id: "new" })}
    />
    <PanelButton
      label="Open"
      icon={FolderOpen}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose a Context first" : "Open the chosen Context"}
      onclick={() => selectedId && open(selectedId)}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose a Context first" : "Copy the chosen Context"}
      onclick={() =>
        selectedId && mockWorkbench.inspect("scope.context", { kind: "context", id: selectedId })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search Contexts"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Saved" count={shown.length} flush>
      {#each shown as row (row.id)}
        <PanelRow
          title={row.name}
          sub={row.resolves === 0 ? `${row.rule} — matches nothing` : row.rule}
          meta={`${row.resolves}`}
          icon={Layers}
          tone={row.resolves === 0 ? "attention" : "default"}
          selected={row.id === selectedId}
          onselect={() => open(row.id)}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
