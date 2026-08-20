<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import { Panel, PanelRow, PanelSearch, PanelSection } from "$lib/unique-components/panel";
  import FileText from "@lucide/svelte/icons/file-text";
  import Folder from "@lucide/svelte/icons/folder";
  import Link2 from "@lucide/svelte/icons/link-2";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Quote from "@lucide/svelte/icons/quote";
  import Sheet from "@lucide/svelte/icons/sheet";

  /**
   * Everything that exists in the project, grouped by what it is.
   *
   * Each row opens the thing in the inspector rather than navigating away, so
   * several can be looked through without losing your place. The one search
   * field filters every group at once.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectResource = () => workbench.inspect("project.resource");
</script>

<!--
  Every section here is a kind of resource, so the whole panel is one list and
  the filter owns all of it. That is why the sections sit inside `PanelSearch`
  rather than beside it — the nesting is the statement of what is filtered.
-->
<Panel title="Resources">
  <PanelSearch placeholder="Filter resources" matched={18} total={18} flush>
    <PanelSection title="Documents" count={3} flush>
      <PanelRow title="Q3 Resilience Memo" icon={FileText} onselect={inspectResource} />
      <PanelRow title="Interconnect Failure Review" icon={FileText} onselect={inspectResource} />
      <PanelRow title="Regulatory Filing Draft" icon={FileText} onselect={inspectResource} />
    </PanelSection>

    <PanelSection title="Slide decks" count={2} flush>
      <PanelRow title="Board Update — October" icon={Presentation} onselect={inspectResource} />
      <PanelRow title="Storm Hardening Options" icon={Presentation} onselect={inspectResource} />
    </PanelSection>

    <PanelSection title="Spreadsheets" count={2} flush>
      <PanelRow title="Outage Cost Model" icon={Sheet} onselect={inspectResource} />
      <PanelRow title="Substation Inventory" icon={Sheet} onselect={inspectResource} />
    </PanelSection>

    <!-- Findings are resources: retrievable anywhere, exactly like a document. -->
    <PanelSection title="Findings" count={2} open={false} flush>
      <PanelRow title="Undergrounding cut SAIDI 38%" icon={Quote} onselect={inspectResource} />
      <PanelRow title="Feeder 12 relay mis-coordinated" icon={Quote} onselect={inspectResource} />
    </PanelSection>

    <PanelSection title="Files and connectors" count={9} flush>
      <PanelRow
        title="SharePoint — Ops Reports"
        sub="Authentication expired"
        icon={Link2}
        tone="danger"
        onselect={() => workbench.inspect("project.connector")}
      />
      <PanelRow
        title="NERC-2025-winter-review.pdf"
        sub="No text layer to extract"
        icon={Folder}
        tone="attention"
        onselect={() => workbench.inspect("project.file")}
      />
      <PanelRow
        title="Google Drive — Filings"
        sub="Synced 2h ago · 148 files"
        icon={Link2}
        tone="success"
        onselect={() => workbench.inspect("project.connector")}
      />
    </PanelSection>
  </PanelSearch>
</Panel>
