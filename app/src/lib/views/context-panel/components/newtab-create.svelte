<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  /**
   * The three editors, listed.
   *
   * The same three choices the centre offers as pills, in list form. Duplicated
   * deliberately: the centre is where you look, the panel is where you land if
   * you came here by keyboard.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
</script>

<Panel title="Create">
  <PanelSection title="Editors" flush>
    <PanelRow title="Document" icon={FileText} onselect={() => workbench.inspect("newtab.document")} />
    <PanelRow title="Slide deck" icon={Presentation} onselect={() => workbench.inspect("newtab.deck")} />
    <PanelRow title="Spreadsheet" icon={Sheet} onselect={() => workbench.inspect("newtab.spreadsheet")} />
  </PanelSection>

  <PanelSection title="Why nothing else is here">
    <PanelNote>
      Research, Analysis, Context, Templates, Personas and Automations are
      permanent tabs. They are not created here because they are never not open.
    </PanelNote>
  </PanelSection>
</Panel>
