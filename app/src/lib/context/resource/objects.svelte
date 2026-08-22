<script lang="ts">
  import ChartBar from "@lucide/svelte/icons/chart-bar";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartLine from "@lucide/svelte/icons/chart-line";
  import ChartPie from "@lucide/svelte/icons/chart-pie";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { objectsIn, type SheetObject } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Charts and overlays floating over the grid — the grid's equivalent of Layers.
   *
   * `docs/screen-panel-views/context/resource/objects.md` is the specification.
   * Anything that is not a cell lives here, because an object anchored underneath
   * another object cannot be reached by clicking the canvas.
   *
   * **The row leads with the type and the anchor tells two apart.** Two column
   * charts have the same name and different addresses, so the address is what
   * makes the list usable; each chart's own title is in its lens.
   *
   * **Overlap is a state, so it is a word and a tone rather than a tint alone.**
   * Overlapping objects on a grid are how one becomes unreachable, which is the
   * whole reason this view exists.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  const objects = $derived(objectsIn(spreadsheetId).current);

  const ICON: Record<SheetObject["kind"], typeof ChartColumn> = {
    Column: ChartColumn,
    Bar: ChartBar,
    Line: ChartLine,
    Pie: ChartPie
  };

  const where = (object: SheetObject) =>
    object.overlapped
      ? `Anchored to ${object.anchor} · overlapped`
      : `Anchored to ${object.anchor}`;
</script>

<Panel title="Objects">
  <PanelSection title="Charts and overlays" count={objects.length} flush>
    {#each objects as object (object.index)}
      <PanelRow
        title="{object.kind} chart"
        sub={where(object)}
        meta={object.size}
        icon={ICON[object.kind]}
        tone={object.overlapped ? "attention" : "default"}
        onselect={() =>
          view.inspect("resource.chart", { kind: "chart", id: String(object.index) })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    A chart identifies itself by its position in this list and by nothing else,
    which is enough to name it here and not enough for granular update, remote
    reconciliation or a comment. Charts render read-only until they have a stable
    id.
  </PanelNote>
</Panel>
