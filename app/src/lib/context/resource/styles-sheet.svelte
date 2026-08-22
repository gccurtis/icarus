<script lang="ts">
  import Palette from "@lucide/svelte/icons/palette";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSearch
  } from "$lib/unique-components/panel";
  import { sheetStyles } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * The named cell styles this spreadsheet uses.
   *
   * `docs/screen-panel-views/context/resource/styles-sheet.md` is the
   * specification, and it holds the same principle as the document and the deck:
   * format lives on a named style rather than as a per-cell override, so changing
   * one reaches every cell that shares it.
   *
   * **A row is a name and the one property that tells it from its neighbours.** A
   * cell style mixes weight, alignment, borders and value format, and listing all
   * four on every row would make four styles look like one paragraph.
   *
   * **New style opens the lens with no style behind it.** What a style is made of
   * is decided there, and there is nothing to hand it until it has been.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  const styles = $derived(sheetStyles(spreadsheetId).current);

  let search = $state("");

  const shown = $derived(
    styles.filter((style) => style.name.toLowerCase().includes(search.trim().toLowerCase()))
  );
</script>

<Panel title="Styles">
  {#snippet actions()}
    <PanelButton
      label="New style"
      icon={Plus}
      tone="primary"
      title="Names the formatting on the current selection"
      onclick={() => view.inspect("resource.named-style-sheet", { kind: "style", id: "" })}
    />
  {/snippet}

  <PanelSearch
    placeholder="Search styles"
    matched={shown.length}
    total={styles.length}
    empty="No style has that name."
    bind:value={search}
    flush
  >
    {#each shown as style (style.id)}
      <PanelRow
        title={style.name}
        sub={style.shorthand}
        meta={`${style.usedByCells} cells`}
        icon={Palette}
        onselect={() =>
          view.inspect("resource.named-style-sheet", { kind: "style", id: style.id })}
      />
    {/each}
  </PanelSearch>

  <PanelNote>
    A style carries typography, alignment, borders and value format together.
    Whether the value format belongs on the style or on the cell is a real
    question: two cells can want the same font and different decimal places.
  </PanelNote>
</Panel>
