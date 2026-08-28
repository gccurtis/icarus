<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import SquarePlus from "@lucide/svelte/icons/square-plus";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$components/authored/panel";
  import { insertBlocks, variableKinds } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Putting content, or a variable, into the template body.
   *
   * `docs/screen-panel-views/context/library/authoring-insert.md` is the
   * specification. The ordinary Insert view with one section added, and that
   * added section is the whole difference between authoring a template and
   * authoring a document.
   *
   * A generated variable is a variable kind rather than an Insert of a prompt
   * block, because it is never a question at instantiation: it becomes a prompt
   * block in the result.
   *
   * **The Variable rows do not press.** No body entity can carry a variable key,
   * so an inserted variable would have nowhere to record which variable it is.
   * They are listed, and the reason they are inert is stated under them, because
   * removing the section would hide the gap this screen is waiting on.
   */
  const blocks = $derived(insertBlocks().current);
  const kinds = $derived(variableKinds().current);
</script>

<Panel title="Insert">
  <!-- Inserting selects what was inserted, which is what puts it in the inspector. -->
  <PanelSection title="Basics" count={blocks.length} flush>
    {#each blocks as block (block.id)}
      <PanelRow
        title={block.name}
        sub={block.detail}
        icon={SquarePlus}
        onselect={() =>
          view.inspect("library.body-entity", { kind: "block", id: block.id })}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Variable" count={kinds.length} flush>
    {#each kinds as kind (kind.id)}
      <PanelRow title={kind.name} sub={kind.detail} meta={kind.makes} icon={Braces} />
    {/each}
    <PanelNote tone="gap">
      Nothing in a body records which variable it stands for, so a variable cannot be placed
      yet.
    </PanelNote>
  </PanelSection>
</Panel>
