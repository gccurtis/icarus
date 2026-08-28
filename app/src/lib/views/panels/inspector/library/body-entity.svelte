<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { bodyEntity } from "$capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Content selected while authoring a template.
   *
   * `docs/screen-panel-views/inspector/library/body-entity.md` is the
   * specification. Authoring a template is authoring a document, so this is the
   * document editor's inspector reused exactly — text, variant, owner. Only the
   * persistence adapter differs underneath: a template embeds its body and saves
   * through revision-CAS.
   *
   * **The owner says "template", in the crumb and in the field.** The reused
   * inspector is otherwise indistinguishable from editing a real document, and a
   * person who cannot tell which one they are in will edit the template thinking
   * they are fixing one filing.
   */
  let { entityId = "be-1" }: { entityId?: string } = $props();

  const view = viewState();

  const entity = $derived(bodyEntity(entityId).current);

  /** Undefined until touched, so an untouched value still reads from the door. */
  let text = $state<string>();
  let variant = $state<string>();
</script>

<Panel title={entity.text}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Template" },
        { label: entity.owner.name, key: "library.template" },
        { label: entity.text }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!-- Not flush: `PanelEditableText` has no gutter of its own. -->
  <PanelSection title="Text">
    <PanelEditableText
      label="Text"
      value={text ?? entity.text}
      placeholder="Empty"
      multiline
      onchange={(next: string) => (text = next)}
    />
  </PanelSection>

  <PanelSection title="Variant" flush>
    <PanelChoice
      label="Variant"
      value={variant ?? entity.variant}
      options={entity.variants.map((name: string) => ({ value: name, label: name }))}
      onchange={(next: string) => (variant = next)}
    />
  </PanelSection>

  <!-- Context rather than the reason the panel opened, so it arrives shut. -->
  <PanelSection title="Owner" open={false} flush>
    <PanelFields>
      <PanelField label={entity.owner.kind}>
        <PanelLink
          label={entity.owner.name}
          title="{entity.owner.name} — the template this content belongs to"
          onselect={() =>
            view.inspect("library.template", {
              kind: "template",
              id: entity.owner.id
            })}
        />
      </PanelField>
    </PanelFields>
    <PanelNote>
      This is the template's body. Editing it changes what the template makes next
      time, and nothing already made from it.
    </PanelNote>
  </PanelSection>
</Panel>
