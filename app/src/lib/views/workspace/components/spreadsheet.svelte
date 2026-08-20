<script lang="ts">
  import type { Tab } from "$model/client";
  import { ScreenPlaceholder } from "$lib/unique-components/screen";

  /**
   * The spreadsheet's workspace: one region, and that region is a Univer grid.
   *
   * A tab is one spreadsheet, not a workbook of sheets — so no sheet tabs — and
   * there is no formula bar and no name box, because the inspector already names
   * the cell and holds its formula.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;
</script>

<ScreenPlaceholder framework="Univer, with its calculation engine bypassed">
  Icarus's formula engine is the only calculation authority — two engines would
  mean two answers, and only one of them can be what a document's inline formula
  reads. On top of the grid Icarus adds project variables, spills that name their
  origin and fail visibly on a write, and dependency inspection derived from the
  current formulas rather than a persisted graph.
</ScreenPlaceholder>
