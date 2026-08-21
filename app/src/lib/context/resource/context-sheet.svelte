<script lang="ts">
  import Library from "@lucide/svelte/icons/library";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { contextsFor } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The saved Contexts a prompt block in this spreadsheet could look up.
   *
   * `docs/screen-panel-views/context/resource/context-sheet.md` is the
   * specification, and it is deliberately the same view the document and deck
   * editors carry — a Context means the same thing in all three.
   *
   * **The resolved count is on the row, and the block count is not.** A grid has
   * no prompt blocks, so "used by 2 blocks" would be a number that cannot be true
   * here. What a Context resolves to is true regardless of who reads it.
   *
   * `onopenscreen` is the one prop that is not an id: the Context screen is a
   * screen, and a panel does not know how to reach one.
   */
  let {
    spreadsheetId = "r-cost",
    onopenscreen
  }: { spreadsheetId?: string; onopenscreen?: () => void } = $props();

  const scopes = $derived(contextsFor(spreadsheetId).current);
</script>

<Panel title="Context">
  <!-- The way out to the screen that owns these, which is where one is edited. -->
  {#snippet actions()}
    <PanelButton label="Open Context screen" icon={Library} onclick={onopenscreen} />
  {/snippet}

  <PanelSection title="Saved Contexts" count={scopes.length} flush>
    {#each scopes as scope (scope.id)}
      <PanelRow
        title={scope.name}
        meta={`${scope.resolves} resolved`}
        onselect={() => mockWorkbench.inspect("scope.context", { kind: "context", id: scope.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Nothing in this spreadsheet reads any of these yet — a grid has no prompt
    blocks. Either prompt blocks land in the grid, or this view is premature on
    this screen.
  </PanelNote>
</Panel>
