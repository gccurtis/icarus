<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  /**
   * Starting from something rather than from nothing.
   *
   * Grouped by what the template makes, matching the three pills in the centre.
   * Scope and variable count sit on each row, because those two decide whether
   * it can be used at all.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
  const open = () => workbench.inspect("newtab.template");
</script>

<Panel title="Templates">
  {#snippet actions()}
    <PanelButton label="Open Templates" tone="ghost" />
  {/snippet}

  <PanelSearch placeholder="Search templates" matched={6} total={6} flush>
    <PanelSection title="Document" count={3} flush>
      <PanelRow title="Regulatory filing shell" sub="Project · 4 variables" icon={FileText} onselect={open} />
      <PanelRow title="Incident review" sub="Global" icon={FileText} onselect={open} />
      <PanelRow title="Storm brief" sub="Project · 3 variables" icon={FileText} onselect={open} />
    </PanelSection>

    <PanelSection title="Slide deck" count={2} flush>
      <PanelRow title="Board update" sub="Project · 2 variables" icon={Presentation} onselect={open} />
      <PanelRow title="Weekly ops deck" sub="Project" icon={Presentation} onselect={open} />
    </PanelSection>

    <PanelSection title="Spreadsheet" count={1} flush>
      <PanelRow title="Cost model skeleton" sub="Project" icon={Sheet} onselect={open} />
    </PanelSection>
  </PanelSearch>

  <PanelNote tone="gap">
    A slide template makes one slide, which is not an editor this tab can open.
    Whether it belongs here at all is unsettled.
  </PanelNote>
</Panel>
