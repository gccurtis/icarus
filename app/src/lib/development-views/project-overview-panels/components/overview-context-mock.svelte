<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelField,
    PanelFields,
    PanelSection
  } from "$authored-components/panel";

  let { stress = false }: { stress?: boolean } = $props();
</script>

<Panel title="Overview">
  <div class="pt-1">
    <PanelSection title="Project" flush>
      <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
      <PanelFields proportional>
        <PanelField label="Status" hierarchy><PanelChip tone="success">Active</PanelChip></PanelField>
        <PanelField label="Your role" hierarchy>{stress ? "Contributing research administrator" : "Owner"}</PanelField>
        <PanelField label="Created" mono stacked hierarchy>May 28, 2026</PanelField>
      </PanelFields>
      </div>
    </PanelSection>
  </div>
</Panel>
