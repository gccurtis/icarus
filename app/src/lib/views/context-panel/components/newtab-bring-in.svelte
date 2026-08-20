<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Link2 from "@lucide/svelte/icons/link-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Upload from "@lucide/svelte/icons/upload";

  /**
   * Getting outside material into the project.
   *
   * Neither uploading a file nor connecting a system opens an editor, so neither
   * competes with the three things this tab exists to make. Both live here.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const connector = () => workbench.inspect("newtab.connector");
</script>

<Panel title="Bring in">
  <PanelSection title="Upload" flush>
    <PanelRow
      title="Choose files…"
      sub="Extraction starts on arrival"
      icon={Upload}
      onselect={() => workbench.inspect("newtab.upload")}
    />
  </PanelSection>

  <PanelSection title="Your connectors" count={2} flush>
    <PanelRow
      title="SharePoint — Ops Reports"
      sub="Authentication expired"
      icon={TriangleAlert}
      tone="danger"
      onselect={connector}
    />
    <PanelRow
      title="Google Drive — Filings"
      sub="Synced 2h ago"
      icon={CircleCheck}
      tone="success"
      onselect={connector}
    />
  </PanelSection>

  <PanelSection title="Add a connector" flush>
    <PanelRow title="SharePoint" icon={Link2} onselect={connector} />
    <PanelRow title="Google Drive" icon={Link2} onselect={connector} />
  </PanelSection>

  <PanelNote>
    Bringing content in is not a way to open an editor, so it lives in the panel
    rather than competing with the three things this tab exists to make.
  </PanelNote>
</Panel>
