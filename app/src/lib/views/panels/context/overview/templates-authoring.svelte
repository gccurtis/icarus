<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { PEOPLE } from "$capabilities/cast";
  import { template } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * This template: what it makes, what it asks for, whether it is saved.
   *
   * `docs/screen-panel-views/context/overview/templates-authoring.md` is the
   * specification.
   *
   * **Kind is a fact, not a field.** What a template makes is fixed at creation;
   * changing it would mean converting the body, which is not modelled — so it is
   * shown rather than offered.
   */
  let {
    templateId = "tp-filing",
    onback
  }: { templateId?: string; onback?: () => void } = $props();

  const it = $derived(template(templateId).current);

  let nameDraft = $state("");

  /** Whose it is, in the library's own words. */
  const reach = $derived(it.scope);

  const author = $derived(PEOPLE.find((person) => person.name === it.createdBy));
</script>

<Panel title="Overview">
  {#snippet actions()}
    <PanelButton label="Back to library" icon={ArrowLeft} onclick={onback} />
  {/snippet}

  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText
        value={nameDraft || it.name}
        label="Template name"
        onchange={(next: string) => (nameDraft = next)}
      />
    </PanelField>
    <PanelField label="Kind">{it.makes}</PanelField>
    <PanelField label="Available in">{reach}</PanelField>
    <PanelField label="Variables" mono>{it.variables}</PanelField>
  </PanelFields>

  <PanelNote>
    What a template makes is fixed when it is created. Changing it would mean
    converting the body, so it is shown here as a fact rather than as a field.
  </PanelNote>

  <PanelSection title="Saved">
    <PanelChip tone="success">Saved · revision {it.revision}</PanelChip>
    <PanelNote>
      A template embeds its body and saves through revision-CAS, which is the one
      thing that differs from the ordinary editor.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <PanelField label="Created by">
        {#if author}
          <PanelLink
            label={it.createdBy}
            title="{it.createdBy} — person"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: author.id })}
          />
        {:else}
          {it.createdBy}
        {/if}
      </PanelField>
      <PanelField label="Updated" mono>{it.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
