<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Layers from "@lucide/svelte/icons/layers";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$components/authored/panel";
  import { contexts, type ContextRow } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * Every saved Context, beside the one being worked on.
   *
   * `docs/screen-panel-views/context/scope/contexts.md` is the specification. The
   * same list the library subscreen leads with, kept here so moving between
   * Contexts is not a mode change.
   *
   * **The line under each name is generated from the rule, never typed.** That is
   * what makes the list scannable: the summary and the count describe the
   * definition as it stands rather than what someone wrote about it once.
   *
   * **A count of zero is a real answer, and it is a warning.** An empty scope
   * broadens retrieval to the whole project rather than restricting it to
   * nothing, so a rule matching nothing does the opposite of what it looks like.
   */
  let { contextId = "cx-drafts" }: { contextId?: string } = $props();

  const view = viewState();

  const all = $derived(contexts().current);

  let search = $state("");
  /** Nothing chosen here yet means the Context this subscreen is already on. */
  let chosenId = $state<string | undefined>(undefined);

  const currentId = $derived(chosenId ?? contextId);
  const current = $derived(all.find((row: ContextRow) => row.id === currentId));

  const shown = $derived(
    all.filter((row: ContextRow) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const open = (id: string) => {
    chosenId = id;
    view.inspect("scope.context", { kind: "context", id });
  };
</script>

<Panel title="Contexts">
  {#snippet actions()}
    <PanelButton
      label="New Context"
      icon={Plus}
      tone="primary"
      onclick={() => view.inspect("scope.context", { kind: "context", id: "new" })}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={current === undefined}
      title={current === undefined ? "Choose a Context first" : `Copy ${current.name}`}
      onclick={() => open(currentId)}
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
          sub={row.inWords}
          meta={String(row.contains)}
          icon={Layers}
          tone={row.contains === 0 ? "attention" : "default"}
          selected={row.id === currentId}
          onselect={() => open(row.id)}
        />
      {/each}

      {#if shown.some((row: ContextRow) => row.contains === 0)}
        <PanelNote>
          A Context matching nothing does not restrict retrieval. An empty scope
          currently broadens it to the whole project.
        </PanelNote>
      {/if}
    </PanelSection>
  </PanelSearch>
</Panel>
