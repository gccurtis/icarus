<script lang="ts">
  import { PanelColor, PanelNumber, PanelSection, PanelSelect } from "$authored-components/panel";
  import { elementIn } from "$app-views/categories/slide-deck-editor/procedures/deck-reading";
  import { withSet, withSets } from "$app-views/categories/slide-deck-editor/procedures/deck-values";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const DASHES = [
    { value: "solid", label: "Solid" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" }
  ];

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const element = $derived(body === undefined ? undefined : elementIn(body, elementId));
  const paint = $derived(element?.paint);

  const setBorder = (value: string) => {
    if (body === undefined) return;
    if (value === "") {
      runtime?.apply(withSet(body, "element", `${elementId}/paint/stroke`, null).ops);
      return;
    }
    runtime?.apply(
      withSets(body, [
        { target: "element", path: `${elementId}/paint/stroke/color`, value },
        { target: "element", path: `${elementId}/paint/stroke/width`, value: paint?.stroke?.width ?? 1 },
        { target: "element", path: `${elementId}/paint/stroke/dash`, value: paint?.stroke?.dash ?? "solid" }
      ]).ops
    );
  };

  const setWidth = (width: number) => {
    if (body === undefined) return;
    if (width === 0) {
      runtime?.apply(withSet(body, "element", `${elementId}/paint/stroke`, null).ops);
      return;
    }
    if (paint?.stroke === undefined) {
      runtime?.apply(
        withSets(body, [
          { target: "element", path: `${elementId}/paint/stroke/color`, value: body.theme.colors.text },
          { target: "element", path: `${elementId}/paint/stroke/width`, value: width },
          { target: "element", path: `${elementId}/paint/stroke/dash`, value: "solid" }
        ]).ops
      );
      return;
    }
    runtime?.apply(withSet(body, "element", `${elementId}/paint/stroke/width`, width).ops);
  };

  const setDash = (dash: string) => {
    if (body === undefined || paint?.stroke === undefined) return;
    runtime?.apply(withSet(body, "element", `${elementId}/paint/stroke/dash`, dash).ops);
  };
</script>

<PanelSection title="Border">
  <div class="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
    <span class="text-caption text-ink-muted">Border</span>
    <div class="flex min-w-0 items-center gap-1.5">
      <PanelColor picker clearable label="Border colour" value={paint?.stroke?.color ?? ""} flush onchange={setBorder} />
      <div class="w-16 shrink-0"><PanelNumber label="Border width" value={paint?.stroke?.width ?? 0} unit="px" min={0} max={40} step={1} flush onchange={setWidth} /></div>
    </div>
    <span class="text-caption text-ink-muted">Dash</span>
    <PanelSelect label="Border dash" value={paint?.stroke?.dash ?? "solid"} options={DASHES} disabled={paint?.stroke === undefined} onchange={setDash} />
  </div>
</PanelSection>
