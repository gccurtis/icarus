<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import TableIcon from "@lucide/svelte/icons/table";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { editorKinds, type EditorKind } from "$mock-capabilities/library";
  import { viewState, type InspectionKey } from "$model/client/view-state";

  const view = viewState();

  /**
   * The three editors, listed.
   *
   * `docs/screen-panel-views/context/library/create.md` is the specification.
   * The same three choices the centre offers as pills, duplicated deliberately:
   * the centre is where you look, this is where you land if you came by keyboard.
   *
   * Choosing one only changes the inspector. Nothing is made until the Create
   * button in that lens, which is why these are rows rather than buttons.
   */
  const kinds = $derived(editorKinds().current);

  let selectedId = $state<string | undefined>(undefined);

  const ICON = { Document: FileText, "Slide deck": Presentation, Spreadsheet: TableIcon };

  const LENS: Record<EditorKind["name"], InspectionKey> = {
    Document: "library.new-document",
    "Slide deck": "library.new-deck",
    Spreadsheet: "library.new-spreadsheet"
  };

  const choose = (kind: EditorKind) => {
    selectedId = kind.id;
    view.inspect(LENS[kind.name], { kind: "editor", id: kind.id });
  };
</script>

<Panel title="Create">
  <PanelSection title="Editors" count={kinds.length} flush>
    {#each kinds as kind (kind.id)}
      <PanelRow
        title={kind.name}
        sub={kind.detail}
        icon={ICON[kind.name]}
        selected={kind.id === selectedId}
        onselect={() => choose(kind)}
      />
    {/each}
  </PanelSection>

  <!--
    The omission is stated rather than left to be noticed. Offering to create a
    Research thread, an Analysis, a Context, a Template, a Persona or an
    Automation would imply those tabs can be absent, and they cannot.
  -->
  <PanelNote>
    Research, Analysis, Context, Templates, Personas and Automations are permanent tabs. They
    are never not open, so there is nothing here to create.
  </PanelNote>
</Panel>
