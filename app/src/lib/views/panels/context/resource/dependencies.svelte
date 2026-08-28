<script lang="ts">
  import Brackets from "@lucide/svelte/icons/brackets";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Hash from "@lucide/svelte/icons/hash";
  import Layers from "@lucide/svelte/icons/layers";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$components/authored/panel";
  import {
    feedsOf,
    problemsIn,
    readsOf,
    type CellReference
  } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * What the current cell reads, what it feeds, and what is broken anywhere in
   * this spreadsheet.
   *
   * `docs/screen-panel-views/context/resource/dependencies.md` is the
   * specification. The two dependency sections are headed by the address, so the
   * panel names the cell it is describing rather than leaving it to be inferred
   * from the grid.
   *
   * **Every row here moves the panel.** Selecting a dependency selects that cell,
   * so the headings change with it and the audit walks — which is the only way to
   * follow a chain without losing your place in the grid. Problems is the
   * exception in scope rather than in behaviour: it lists the whole spreadsheet,
   * because finding a broken cell is why anyone opens this.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  /** The cell the grid is on. `G3` when nothing is selected, as the specification has it. */
  const address = $derived(view.selection?.kind === "cell" ? view.selection.id : "G3");

  const reads = $derived(readsOf(spreadsheetId, address).current);
  const feeds = $derived(feedsOf(spreadsheetId, address).current);
  const problems = $derived(problemsIn(spreadsheetId).current);

  /** What a reference is, at a glance: a value, an expression, a spill, a name, or nothing. */
  const REFERENCE_ICON: Record<CellReference["kind"], typeof Hash> = {
    value: Hash,
    formula: SquareFunction,
    "spill child": Layers,
    "named range": Brackets,
    broken: CircleAlert
  };

  /**
   * A broken reference has no target and therefore no click: there is nothing at
   * `#REF!` to select, and a row that looked selectable would promise otherwise.
   */
  const follow = (reference: CellReference): (() => void) | undefined => {
    if (reference.kind === "broken") return undefined;
    if (reference.kind === "named range") {
      return () =>
        view.inspect("resource.named-range", {
          kind: "named-range",
          id: reference.address
        });
    }
    return () => view.inspect("resource.cell", { kind: "cell", id: reference.address });
  };
</script>

<Panel title="Dependencies">
  <PanelSection title="{address} reads" count={reads.length} flush>
    {#each reads as reference (reference.address)}
      <!-- `shows` is the value on this side, so it fits the meta column. -->
      <PanelRow
        title={reference.address}
        sub={reference.note}
        meta={reference.shows}
        icon={REFERENCE_ICON[reference.kind]}
        tone={reference.kind === "broken" ? "danger" : "default"}
        titleTone={reference.kind === "broken" ? "danger" : undefined}
        onselect={follow(reference)}
      />
    {/each}

    {#if reads.length === 0}
      <PanelNote>Nothing. {address} depends on no other cell.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="{address} feeds" count={feeds.length} flush>
    {#each feeds as reference (reference.address)}
      <!-- And the formula on this side, which is too long for the meta column. -->
      <PanelRow
        title={reference.address}
        sub={reference.shows}
        icon={SquareFunction}
        onselect={() =>
          view.inspect("resource.cell-with-formula", {
            kind: "cell",
            id: reference.address
          })}
      />
    {/each}

    {#if feeds.length === 0}
      <PanelNote>Nothing. No formula in this spreadsheet refers to {address}.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Problems" count={problems.length} flush>
    {#each problems as problem (problem.address)}
      <PanelRow
        title="{problem.address} · {problem.error}"
        sub={problem.explanation}
        icon={TriangleAlert}
        tone="danger"
        titleTone="danger"
        onselect={() =>
          view.inspect("resource.error-cell", { kind: "cell", id: problem.address })}
      />
    {/each}

    {#if problems.length === 0}
      <PanelNote>Every formula in this spreadsheet resolves.</PanelNote>
    {/if}
  </PanelSection>

  <PanelNote>
    Neither direction is stored. Reads are parsed out of the selected formula and
    feeds are a reverse scan over every other formula, both on the selection
    changing — so nothing here can be stale, and a large grid pays for the scan
    each time.
  </PanelNote>
</Panel>
