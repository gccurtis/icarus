<script lang="ts">
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import BringToFront from "@lucide/svelte/icons/bring-to-front";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import Image from "@lucide/svelte/icons/image";
  import Lock from "@lucide/svelte/icons/lock";
  import SendToBack from "@lucide/svelte/icons/send-to-back";
  import Table from "@lucide/svelte/icons/table";
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { layersOn, layoutObjectsOn } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * What is on this slide, in stacking order, and which of it the slide may touch.
   *
   * `docs/screen-panel-views/context/resource/layers.md` is the specification.
   * Anything selectable by clicking the canvas is selectable here, which is what
   * makes this list the canvas's accessibility fallback rather than a summary of
   * it.
   *
   * **Depth is the row's position, not a stored word.** The list *is* the
   * stacking order, so a reorder that left "Front" sitting beside the second row
   * would be the list contradicting itself.
   */
  let { slideId = "sl-4" }: { slideId?: string } = $props();

  const view = viewState();

  const layers = $derived(layersOn(slideId).current);
  const owned = $derived(layoutObjectsOn(slideId).current);

  /** Reordering is held here: no door writes a z-order, and four inert verbs are worse. */
  let order = $state<readonly string[] | undefined>(undefined);

  const stack = $derived.by(() => {
    if (order === undefined) return layers;
    return order.flatMap((id) => layers.filter((layer) => layer.id === id));
  });

  const selectedId = $derived(
    view.selection?.kind === "element" ? view.selection.id : undefined
  );
  const movable = $derived(stack.some((layer) => layer.id === selectedId));

  const move = (to: "front" | "forward" | "back" | "behind") => {
    const id = selectedId;
    if (id === undefined) return;
    const ids = stack.map((layer) => layer.id);
    const at = ids.indexOf(id);
    if (at < 0) return;

    const rest = ids.filter((_, index) => index !== at);
    const target =
      to === "front"
        ? 0
        : to === "behind"
          ? rest.length
          : to === "forward"
            ? Math.max(0, at - 1)
            : Math.min(rest.length, at + 1);

    order = [...rest.slice(0, target), id, ...rest.slice(target)];
  };

  const depthOf = (index: number, total: number) =>
    index === 0 ? "Front" : index === total - 1 ? "Back" : "Middle";

  const KIND_ICON = { text: Type, chart: ChartColumn, image: Image, table: Table };
</script>

<Panel title="Layers">
  <!--
    The four verbs act on the selection, so they are off until something on this
    slide is selected. Align and distribute are deliberately absent: they are
    properties of a selection and belong in the inspector.
  -->
  {#snippet actions()}
    <PanelButton
      label="Front"
      icon={BringToFront}
      disabled={!movable}
      onclick={() => move("front")}
    />
    <PanelButton label="Forward" icon={ArrowUp} disabled={!movable} onclick={() => move("forward")} />
    <PanelButton label="Back" icon={ArrowDown} disabled={!movable} onclick={() => move("back")} />
    <PanelButton
      label="Behind"
      icon={SendToBack}
      disabled={!movable}
      onclick={() => move("behind")}
    />
  {/snippet}

  <PanelSection title="Slide objects" count={stack.length} flush>
    {#each stack as layer, index (layer.id)}
      <PanelRow
        title={layer.name}
        meta={depthOf(index, stack.length)}
        icon={KIND_ICON[layer.kind]}
        selected={layer.id === selectedId}
        onselect={() => view.inspect("resource.element", { kind: "element", id: layer.id })}
      />
    {/each}
  </PanelSection>

  <!--
    A second list rather than more rows in the first: what the layout owns cannot
    be edited from the slide, and rows that looked the same would promise it could.
  -->
  <PanelSection title="Layout objects" count={owned.length} flush>
    {#each owned as object (object.id)}
      <PanelRow
        title={object.name}
        sub="Locked · layout-owned"
        icon={Lock}
        onselect={() =>
          view.inspect("resource.locked-element", {
            kind: "locked-element",
            id: object.id
          })}
      />
    {/each}
  </PanelSection>

  <PanelNote tone="gap">
    Cross-layer order between layout-owned and slide-owned objects is undefined in
    the model. Two lists cannot express one stack, and these two are pretending
    they can.
  </PanelNote>
</Panel>
