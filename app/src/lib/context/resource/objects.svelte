<script lang="ts">
  import ChartBar from "@lucide/svelte/icons/chart-bar";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChartPie from "@lucide/svelte/icons/chart-pie";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { objectsIn, type SheetObject } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

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

  const objects = $derived(objectsIn(spreadsheetId).current);

  const ICON: Record<SheetObject["kind"], typeof ChartColumn> = {
    Column: ChartColumn,
    Bar: ChartBar,
    Pie: ChartPie
  };

  const sizeOf = (object: SheetObject) => `${object.size.width} × ${object.size.height} px`;

  const where = (object: SheetObject) =>
    object.overlapped
      ? `Anchored to ${object.anchor} · overlapped`
      : `Anchored to ${object.anchor}`;
</script>

<Panel title="Objects">
  <PanelSection title="Charts and overlays" count={objects.length} flush>
    {#each objects as object (object.id)}
      <PanelRow
        title="{object.kind} chart"
        sub={where(object)}
        meta={sizeOf(object)}
        icon={ICON[object.kind]}
        tone={object.overlapped ? "attention" : "default"}
        onselect={() =>
          mockWorkbench.inspect("resource.chart", { kind: "chart", id: object.id })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Each chart, datum, axis, and added element has a stable id. The list can be
    reordered without changing what an inspector, comment, or revision addresses.
  </PanelNote>
</Panel>
