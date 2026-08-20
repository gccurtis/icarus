<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import FileText from "@lucide/svelte/icons/file-text";
  import FlaskConical from "@lucide/svelte/icons/flask-conical";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  /**
   * What you had open lately, and what changed lately.
   *
   * Grouped by day. Every kind appears, including Research threads, because
   * "what was I doing" does not respect the distinction between a resource and
   * a thread.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const open = () => workbench.inspect("newtab.recent");
</script>

<Panel title="Recent">
  <PanelSearch placeholder="Search everything" matched={6} total={6} flush>
    <PanelSection title="Today" flush>
      <PanelRow title="Q3 Resilience Memo" meta="4m" icon={FileText} onselect={open} />
      <PanelRow title="Board Update — October" meta="2h" icon={Presentation} onselect={open} />
    </PanelSection>

    <PanelSection title="Yesterday" flush>
      <PanelRow title="Outage Cost Model" meta="1d" icon={Sheet} onselect={open} />
      <PanelRow title="Why did Feeder 12 fail twice?" meta="1d" icon={FlaskConical} onselect={open} />
    </PanelSection>

    <PanelSection title="Earlier" flush>
      <PanelRow title="Interconnect Failure Review" meta="2d" icon={FileText} onselect={open} />
      <PanelRow title="Substation Inventory" meta="4d" icon={Sheet} onselect={open} />
    </PanelSection>
  </PanelSearch>

  <PanelNote>
    Recently opened comes from local tab history; recently updated comes from
    updatedAt. Neither is a persisted favourite, and this view merges the two.
  </PanelNote>
</Panel>
