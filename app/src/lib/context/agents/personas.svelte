<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import Copy from "@lucide/svelte/icons/copy";
  import FolderOpen from "@lucide/svelte/icons/folder-open";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { personasIn, type PersonaRow } from "$mock-capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Every agent available here, grouped by where it is available.
   *
   * `docs/screen-panel-views/context/agents/personas.md` is the specification.
   * The grouping is the whole content of the panel: a global persona is not this
   * project's to edit, and the two headings are the only place that is said.
   *
   * **The row carries what the persona has done, not what it describes.** Two
   * personas with similar descriptions are told apart by their record, so the
   * count is the qualifier and the description is left to the profile.
   *
   * **Delete is absent rather than disabled.** Forty-one tasks and six
   * conversations name a persona, and there is no tombstone policy that would
   * keep those labels readable after a hard delete.
   */
  const all = $derived(personasIn(view.project).current);

  let search = $state("");
  let selectedId = $state<string | undefined>(undefined);

  const shown = $derived(
    all.filter((row: PersonaRow) => row.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const inScope = (scope: PersonaRow["scope"]): readonly PersonaRow[] =>
    shown.filter((row: PersonaRow) => row.scope === scope);

  /** Running is left off when there is none, so a quiet persona reads as quiet. */
  const record = (row: PersonaRow): string =>
    row.running === 0 ? `${row.tasks} tasks` : `${row.tasks} tasks · ${row.running} running`;

  const open = (id: string) => {
    selectedId = id;
    view.inspect("agents.persona", { kind: "persona", id });
  };
</script>

<Panel title="Personas">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      onclick={() => view.inspect("agents.persona", { kind: "persona", id: "new" })}
    />
    <PanelButton
      label="Open"
      icon={FolderOpen}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose a persona first" : "Open the chosen persona"}
      onclick={() => selectedId && open(selectedId)}
    />
    <PanelButton
      label="Duplicate"
      icon={Copy}
      disabled={selectedId === undefined}
      title={selectedId === undefined ? "Choose a persona first" : "Copy the chosen persona"}
      onclick={() => selectedId && open(selectedId)}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search personas"
    matched={shown.length}
    total={all.length}
    bind:value={search}
    flush
  >
    <PanelSection title="This project" count={inScope("This project").length} flush>
      {#each inScope("This project") as row (row.id)}
        <PanelRow
          title={row.name}
          sub={record(row)}
          icon={Bot}
          tone={row.running > 0 ? "active" : "default"}
          selected={row.id === selectedId}
          onselect={() => open(row.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Everywhere" count={inScope("Everywhere").length} flush>
      {#each inScope("Everywhere") as row (row.id)}
        <PanelRow
          title={row.name}
          sub={record(row)}
          icon={Bot}
          tone={row.running > 0 ? "active" : "default"}
          selected={row.id === selectedId}
          onselect={() => open(row.id)}
        />
      {/each}

      <PanelNote tone="gap">
        Whether a persona available everywhere may be edited from here is a
        deployment rule the model does not carry, so the row cannot say.
      </PanelNote>
    </PanelSection>
  </PanelSearch>
</Panel>
