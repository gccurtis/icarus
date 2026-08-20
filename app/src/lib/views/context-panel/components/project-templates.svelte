<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  /**
   * The templates available here, grouped by what they make.
   *
   * Grouped by target because the first question about a template is what it
   * produces. Scope and variable count sit on the row, because those two decide
   * whether you can use it.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const inspectTemplate = () => workbench.inspect("project.resource");
</script>

<Panel title="Templates">
  {#snippet actions()}
    <PanelButton label="Open Templates" tone="ghost" />
  {/snippet}

  <PanelSearch placeholder="Search templates" matched={4} total={4} flush>
    <PanelSection title="Documents" count={2} flush>
      <PanelRow
        title="Regulatory filing shell"
        sub="Project · 4 variables"
        icon={FileText}
        onselect={inspectTemplate}
      />
      <PanelRow title="Incident review" sub="Global" icon={FileText} onselect={inspectTemplate} />
    </PanelSection>

    <PanelSection title="Slide decks" count={1} flush>
      <PanelRow
        title="Board update"
        sub="Project · 2 variables"
        icon={Presentation}
        onselect={inspectTemplate}
      />
    </PanelSection>

    <PanelSection title="Spreadsheets" count={1} flush>
      <PanelRow title="Cost model skeleton" sub="Project" icon={Sheet} onselect={inspectTemplate} />
    </PanelSection>
  </PanelSearch>
</Panel>
