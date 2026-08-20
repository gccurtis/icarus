<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { ScreenThumb } from "$lib/unique-components/screen";

  /**
   * What a deck will be, before it exists.
   *
   * Aspect ratio is asked explicitly because there is no modeled default to fall
   * back to, and because changing it later re-frames every element on every
   * slide.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Slide deck">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Slide deck" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Title" stacked>Untitled deck</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Format">
    <PanelActions>
      <PanelChip tone="active">16:9</PanelChip>
      <PanelChip>4:3</PanelChip>
    </PanelActions>
    <PanelNote>
      Asked explicitly. There is no modeled project or user default to fall back
      to.
    </PanelNote>
  </PanelSection>

  <PanelSection title="First slide">
    <div class="preview"><ScreenThumb ratio="16 / 9" lines={2} /></div>
    <PanelNote>Title and body.</PanelNote>
  </PanelSection>

  <PanelSection title="Create">
    <PanelActions><PanelButton label="Create deck" tone="primary" /></PanelActions>
  </PanelSection>
</Panel>

<style>
  .preview {
    padding-inline: calc(var(--token-spacing-unit) * 3);
    max-width: 12rem;
  }
</style>
