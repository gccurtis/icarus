<script lang="ts">
  import { Panel, PanelCrumbs, PanelEmpty, PanelNote } from "$authored-components/panel";
</script>

<Panel title="Chart">
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Deck" }, { label: "Slide" }, { label: "Chart" }]} onnavigate={() => {}} />
  {/snippet}
  <PanelEmpty title="Charts on slides come after the analysis chart settles. A chart's marks already carry stable ids, so a bar will be selectable inside a slide the day this lands." />
  <PanelNote>Not built yet · <span class="font-mono">slide-deck-editor.chart</span></PanelNote>
</Panel>
