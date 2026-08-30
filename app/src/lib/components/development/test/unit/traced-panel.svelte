<script lang="ts">
  import { Panel, PanelField, PanelFields } from "$authored-components/panel";

  /**
   * A panel, for the trace test to render.
   *
   * A fixture rather than a real panel from `views/panels/`: what is being
   * proved is that a primitive registers itself and nests under the one that
   * drew it, which is a fact about the trace and not about any panel. Pointing
   * the test at a real one made it fail the day that panel was deleted, and told
   * nobody anything true about tracing.
   */
</script>

<Panel title="Mira Jain">
  <PanelFields>
    <PanelField label="Email">mira.jain@northwind.example</PanelField>
    <PanelField label="Role">Owner</PanelField>
  </PanelFields>
</Panel>
