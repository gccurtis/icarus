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
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  /**
   * A file that came in from somewhere, and whether anything in it can be read.
   *
   * An external file is only useful once text has come out of it. This lens leads
   * with identity but exists mostly for the second section.
   */
  const { workbench } = clientModel();
</script>

<Panel title="NERC-2025-winter-review.pdf">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Project", key: "project.self" },
        { label: "NERC-2025-winter-review.pdf" }
      ]}
      onnavigate={(key) => workbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="File">
    <PanelFields>
      <PanelField label="Title">NERC-2025-winter-review.pdf</PanelField>
      <PanelField label="Type">PDF</PanelField>
      <PanelField label="Size" mono>4.2 MB</PanelField>
      <PanelField label="Origin">SharePoint — Ops Reports</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    The failure is stated as what it costs — nothing in this file is retrievable
    until text comes out of it — rather than as an error code.
  -->
  <PanelSection title="Extraction">
    <PanelActions><PanelChip tone="danger">Could not read</PanelChip></PanelActions>
    <PanelFields>
      <PanelField label="Reason">Scanned document with no text layer</PanelField>
      <PanelField label="Attempted" mono>4 days ago</PanelField>
    </PanelFields>
    <PanelActions>
      <PanelButton
        label="Retry extraction"
        icon={RefreshCw}
        title="A structural failure will fail again — the reason needs a retryable flag"
      />
    </PanelActions>
    <PanelNote>Nothing in this file is retrievable until text comes out of it.</PanelNote>
  </PanelSection>

  <PanelSection title="Connector" open={false}>
    <PanelFields>
      <PanelField label="Connector">SharePoint — Ops Reports</PanelField>
      <PanelField label="Still syncing">No — authentication expired</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
