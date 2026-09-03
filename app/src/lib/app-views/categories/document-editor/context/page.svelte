<script lang="ts">
  import { Panel, PanelField, PanelFields, PanelSection } from "$authored-components/panel";
  import {
    DEFAULT_PAGE_SETUP,
    inches,
    layoutMetrics,
    orientationLabel,
    paperLabel
  } from "$app-views/categories/document-editor/procedures/page-setup";

  const { paper, orientation, margins } = DEFAULT_PAGE_SETUP;
  const metrics = layoutMetrics(DEFAULT_PAGE_SETUP);
</script>

<Panel title="Page">
  <PanelSection title="Paper">
    <PanelFields>
      <PanelField label="Size">{paperLabel(paper)}</PanelField>
      <PanelField label="Orientation">{orientationLabel(orientation)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Margins">
    <PanelFields>
      <PanelField label="Top" mono>{inches(margins.top)}</PanelField>
      <PanelField label="Right" mono>{inches(margins.right)}</PanelField>
      <PanelField label="Bottom" mono>{inches(margins.bottom)}</PanelField>
      <PanelField label="Left" mono>{inches(margins.left)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Typesetting">
    <PanelFields>
      <PanelField label="Font size" mono>{metrics.bodyFontSize}</PanelField>
      <PanelField label="Line height" mono>{metrics.bodyLineHeight}</PanelField>
      <PanelField label="Characters" mono>{metrics.charactersPerLine} per line</PanelField>
      <PanelField label="Lines" mono>{metrics.linesPerPage} per page</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
