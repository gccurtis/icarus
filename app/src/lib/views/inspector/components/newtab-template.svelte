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
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { ScreenThumb } from "$lib/unique-components/screen";
  import Database from "@lucide/svelte/icons/database";
  import Hash from "@lucide/svelte/icons/hash";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  /**
   * A template, what it will ask you for, and using it.
   *
   * Enough to decide whether this is the one you want without going to the
   * Templates tab. Editing happens there.
   */
  const { workbench } = clientModel();
</script>

<Panel title="Regulatory filing shell">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Regulatory filing shell" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Identity">
    <PanelFields>
      <PanelField label="Name" stacked>Regulatory filing shell</PanelField>
      <PanelField label="Target">Document</PanelField>
      <PanelField label="Scope"><PanelChip tone="accent-2">Project</PanelChip></PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    Rendered from the real body: the model has no thumbnail field, and the
    library must not imply one.
  -->
  <PanelSection title="Preview">
    <div class="preview"><ScreenThumb ratio="4 / 3" lines={5} variables={2} /></div>
  </PanelSection>

  <PanelSection title="Variables it asks for" count={4} flush>
    <PanelRow title="filingDocket" sub="Text · required" icon={Hash} />
    <PanelRow title="filingParty" sub="Text · required" icon={Hash} />
    <PanelRow title="outageTable" sub="Table · required" icon={Database} />
    <PanelRow title="execSummary" sub="Generated · optional" icon={Sparkles} tone="intelligence" />
  </PanelSection>

  <PanelSection title="Create">
    <PanelActions>
      <PanelButton label="Use template" tone="primary" disabled title="Blocked: see below" />
    </PanelActions>
    <PanelNote tone="gap">
      Blocked until a body entity can carry a variable key. Nothing in a body
      records which variable it stands for, so a filled value has nowhere to go.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  .preview {
    padding-inline: calc(var(--token-spacing-unit) * 3);
    max-width: 11rem;
  }
</style>
