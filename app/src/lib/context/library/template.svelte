<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";

  import {
    Panel,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect
  } from "$lib/unique-components/panel";
  import { PEOPLE } from "$mock-capabilities/cast";
  import {
    recentlyUsedTemplates,
    template as templateDoor,
    type LibraryTemplate
  } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * The template being authored: what it makes, whose it is, and where it is used.
   *
   * Distinct from the authoring panels beside it, which are about the body —
   * this one is about the template as a *thing in a library*, which is the part
   * you set once and then stop thinking about.
   *
   * **What it makes is fixed at creation and shown as a fact.** Changing it would
   * invalidate every variable in the body, so it is not a control here; making a
   * different kind of template is making a different template.
   */
  const id = $derived(view.active.focus ?? "tp-filing");

  const it = $derived(templateDoor(id).current);
  const used = $derived(
    recentlyUsedTemplates().current.filter((row: LibraryTemplate) => row.id === it.id)
  );

  /** Undefined until touched, so an untouched value still reads from the door. */
  let renamed = $state<string>();
  let scope = $state<string>();

  const SCOPES = [
    { value: "Project", label: "Project" },
    { value: "Shared", label: "Shared" },
    { value: "Personal", label: "Personal" }
  ] as const;

  const author = $derived(PEOPLE.find((person) => person.name === it.createdBy));
</script>

<Panel title="Template">
  <PanelFields>
    <PanelField label="Name">
      <PanelEditableText
        value={renamed ?? it.name}
        label="Template name"
        onchange={(next: string) => (renamed = next)}
      />
    </PanelField>

    <PanelField label="Makes">
      <PanelChip>{it.makes}</PanelChip>
    </PanelField>

    <PanelField label="Belongs to">
      <PanelSelect
        label="Who owns this template"
        value={scope ?? it.scope}
        options={SCOPES}
        onchange={(next: string) => (scope = next)}
      />
    </PanelField>

    <PanelField label="Variables">{it.variables}</PanelField>
    <PanelField label="Revision">{it.revision}</PanelField>
    <PanelField label="Changed">{it.updated}</PanelField>
  </PanelFields>

  {#if author}
    <PanelSection title="Built by" flush>
      <PanelRow
        title={author.name}
        sub={author.role}
        onselect={() =>
          view.inspect("collaboration.person", { kind: "person", id: author.id })}
      />
    </PanelSection>
  {/if}

  <PanelSection title="Used" count={used.length} flush>
    {#each used as row (row.id)}
      <PanelRow title={row.name} sub="last used {row.lastUsed}" icon={FileText} />
    {:else}
      <PanelNote>Nothing has been made from it yet.</PanelNote>
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Renaming and re-scoping are held here. There is no capability to write either
    back, so neither survives a reload.
  </PanelNote>
</Panel>
