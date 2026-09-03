<script lang="ts">
  import { Panel, PanelField, PanelFields, PanelSection } from "$authored-components/panel";
  import {
    DEFAULT_PAGE_SETUP,
    figures,
    inches,
    layoutMetrics,
    orientationLabel,
    paperLabel
  } from "$app-views/categories/document-editor/procedures/page-setup";

  const { paper, orientation, margins } = DEFAULT_PAGE_SETUP;
  const metrics = layoutMetrics(DEFAULT_PAGE_SETUP);
</script>

<Panel title="Layout">
  <PanelSection title="Paper">
    <PanelFields>
      <PanelField label="Size" stacked>{paperLabel(paper)}</PanelField>
      <PanelField label="Orientation" stacked>{orientationLabel(orientation)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Dimensions">
    <PanelFields>
      <PanelField label="Page (in)" mono stacked>{figures(metrics.paper)}</PanelField>
      <PanelField label="Text area (in)" mono stacked>{figures(metrics.content)}</PanelField>
      <PanelField label="At 100% (rem)" mono stacked>{figures(metrics.drawn)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Margins">
    <PanelFields>
      <PanelField label="Top" mono stacked>{inches(margins.top)}</PanelField>
      <PanelField label="Right" mono stacked>{inches(margins.right)}</PanelField>
      <PanelField label="Bottom" mono stacked>{inches(margins.bottom)}</PanelField>
      <PanelField label="Left" mono stacked>{inches(margins.left)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Typesetting">
    <PanelFields>
      <PanelField label="Font size" mono stacked>{metrics.bodyFontSize}</PanelField>
      <PanelField label="Line height" mono stacked>{metrics.bodyLineHeight}</PanelField>
      <PanelField label="Characters" mono stacked>{metrics.charactersPerLine} per line</PanelField>
      <PanelField label="Lines" mono stacked>{metrics.linesPerPage} per page</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
