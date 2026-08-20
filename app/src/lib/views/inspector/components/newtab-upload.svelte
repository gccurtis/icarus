<script lang="ts">
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelActions,
    PanelChip,
    PanelCrumbs,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import Folder from "@lucide/svelte/icons/folder";
  import Sheet from "@lucide/svelte/icons/sheet";

  /** Files on their way into the project. */
  const { workbench } = clientModel();
</script>

<Panel title="Upload">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Upload" }]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Files" count={2} flush>
    <PanelRow title="storm-log-2026-01.csv" sub="1.1 MB · text/csv" icon={Sheet} />
    <PanelRow title="feeder-12-relay.pdf" sub="820 KB · application/pdf" icon={Folder} />
  </PanelSection>

  <PanelSection title="Ingestion">
    <PanelActions><PanelChip tone="active">Uploading 2 of 2</PanelChip></PanelActions>
    <PanelNote tone="gap">
      Staged upload IDs survive a tab switch; raw file handles do not survive a
      reload. An upload interrupted by one has to fail visibly rather than appear
      to still be running.
    </PanelNote>
  </PanelSection>
</Panel>
