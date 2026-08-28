<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { deckStyle } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A named style in the deck's theme: typography edited once, for everywhere it
   * is used.
   *
   * `docs/screen-panel-views/inspector/resource/named-style-deck.md` is the
   * specification.
   *
   * **The style key is shown and not edited.** A layout placeholder names a style
   * by key rather than by name, so the key is a reference other objects hold;
   * renaming the style is safe and re-keying it is not.
   */
  let { styleId = "ks-title" }: { styleId?: string } = $props();

  const view = viewState();

  const style = $derived(deckStyle(styleId).current);

  let renamed = $state<string | undefined>(undefined);
  const name = $derived(renamed ?? style.name);

  const elements = $derived(
    style.usedByElements === 1 ? "1 element" : `${style.usedByElements} elements`
  );
</script>

<Panel title={name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Theme", key: "resource.theme" }, { label: name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "style", id: styleId });
      }}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Name">
        <PanelEditableText
          label="Style name"
          value={name}
          onchange={(next: string) => (renamed = next)}
        />
      </PanelField>
      <PanelField label="Style key" mono>{style.styleKey}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Name and key can drift apart. Whether the key is authored or derived from the
      name when the style is made has not been settled, so the key is read here.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Typography">
    <PanelFields>
      <PanelField label="Family">{style.family}</PanelField>
      <PanelField label="Size" mono>{style.size}</PanelField>
      <PanelField label="Weight" mono>{style.weight}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      No line height. The document editor's styles carry one and a deck's do not,
      so a title that wraps to two lines will not set the same way twice.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Usage" open={false}>
    <PanelNote>Applied to {elements}.</PanelNote>
  </PanelSection>
</Panel>
