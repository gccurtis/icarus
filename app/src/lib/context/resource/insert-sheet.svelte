<script lang="ts">
  import ChartBar from "@lucide/svelte/icons/chart-bar";
  import ChartArea from "@lucide/svelte/icons/chart-area";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartPie from "@lucide/svelte/icons/chart-pie";
  import ChartScatter from "@lucide/svelte/icons/chart-scatter";
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import Rows3 from "@lucide/svelte/icons/rows-3";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import TableCellsMerge from "@lucide/svelte/icons/table-cells-merge";
  import Variable from "@lucide/svelte/icons/variable";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import {
    insertOptions,
    rangeSelection,
    type InsertOption
  } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Putting something new into the spreadsheet.
   *
   * `docs/screen-panel-views/context/resource/insert-sheet.md` is the
   * specification. Every entry inserts and then selects what it inserted, so the
   * inspector is where the new thing is configured and this view never grows a
   * form of its own.
   *
   * **A blocked entry is drawn, not hidden, and it is not a target.** It carries
   * the reason it cannot be used on the row. Existing chart objects are
   * interactive; creation remains blocked until the selected-range adapter can
   * build their identified data in one mutation.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  const options = $derived(insertOptions("spreadsheet").current);

  /** Insert acts on the selection. `A9` is the first free row under the model. */
  const address = $derived(view.selection?.kind === "cell" ? view.selection.id : "A9");

  /** The same selection as a block, which is what the structural entries act on. */
  const block = $derived(rangeSelection(spreadsheetId, address).current.a1);

  const ICON: Record<string, typeof ChartColumn> = {
    "ins-g-column": ChartColumn,
    "ins-g-bar": ChartBar,
    "ins-g-line": ChartLine,
    "ins-g-area": ChartArea,
    "ins-g-scatter": ChartScatter,
    "ins-g-bubble": ChartScatter,
    "ins-g-pie": ChartPie,
    "ins-g-waterfall": ChartColumn,
    "ins-g-mekko": ChartColumn,
    "ins-g-funnel": ChartPie,
    "ins-g-radar": ChartArea,
    "ins-g-heatmap": ChartColumn,
    "ins-g-treemap": ChartColumn,
    "ins-g-formula": SquareFunction,
    "ins-g-variable": Variable,
    "ins-g-prompt": Sparkles,
    "ins-g-rows": Rows3,
    "ins-g-cols": Columns3,
    "ins-g-merge": TableCellsMerge
  };

  const inGroup = (group: InsertOption["group"]) =>
    options.filter((option) => option.group === group);

  /**
   * What was inserted becomes the selection: the cell for the two that go inside
   * one, the affected block for the three that change the grid's shape.
   */
  const insert = (option: InsertOption) => {
    if (option.group === "Structure") {
      view.inspect("resource.range", { kind: "range", id: block });
      return;
    }
    view.inspect(
      option.id === "ins-g-formula" ? "resource.cell-with-formula" : "resource.cell",
      { kind: "cell", id: address }
    );
  };
</script>

<Panel title="Insert">
  <PanelSection title="Charts" count={inGroup("Charts").length} flush>
    {#each inGroup("Charts") as option (option.id)}
      <PanelRow
        title={option.label}
        sub={option.blocked ?? option.note}
        icon={ICON[option.id]}
        tone={option.blocked ? "attention" : "default"}
        onselect={option.blocked ? undefined : () => insert(option)}
      />
    {/each}

    <PanelNote tone="gap">
      All twelve native chart types are identified and interactive. Creating one
      still needs the mutation that resolves the selected range into stable
      categories, series and datums and validates the selected type's channels.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Content" count={inGroup("Content").length} flush>
    {#each inGroup("Content") as option (option.id)}
      <!--
        Formula and Variable are one row apart and easily confused, so each says
        which it is: a variable is a reference, a formula is an expression that
        may contain one.
      -->
      <PanelRow
        title={option.label}
        sub={option.blocked ?? option.note}
        icon={ICON[option.id]}
        tone={option.blocked ? "attention" : "default"}
        onselect={option.blocked ? undefined : () => insert(option)}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Structure" count={inGroup("Structure").length} flush>
    {#each inGroup("Structure") as option (option.id)}
      <PanelRow
        title={option.label}
        sub={option.blocked ?? option.note}
        icon={ICON[option.id]}
        tone={option.blocked ? "attention" : "default"}
        onselect={option.blocked ? undefined : () => insert(option)}
      />
    {/each}

    <PanelNote tone="gap">
      These three are the most dangerous commands on the screen. Inserting a row
      or a column has to rebase A1 keys, formulas, comments, named ranges, merges,
      spills and chart anchors at once — atomically, or rejected with the work
      preserved — and there is no such contract yet.
    </PanelNote>
  </PanelSection>
</Panel>
