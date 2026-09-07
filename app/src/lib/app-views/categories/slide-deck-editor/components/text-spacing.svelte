<script lang="ts">
  import {
    PanelControlGroup,
    PanelControlRow,
    PanelNumber,
    PanelSection
  } from "$authored-components/panel";
  import {
    blockIn,
    withSet
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  let { blockId, open = false }: { blockId: string; open?: boolean } = $props();

  const view = workspaceState();
  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const block = $derived(body === undefined ? undefined : blockIn(body, blockId));
  const styleKey = $derived(block?.style ?? body?.styles.defaultKey ?? "body");
  const style = $derived(body?.styles.styles[styleKey]);
  const format = $derived(block?.format);

  const set = (field: string, value: number) => {
    if (body === undefined) return;
    const edit = withSet(body, `${blockId}/format/${field}`, value);
    if (edit.ops.length > 0) runtime?.apply(edit.ops);
  };
</script>

<PanelSection title="Spacing" {open} chevron="end">
  <PanelControlGroup flush>
    <PanelControlRow label="Space above">
      <PanelNumber label="Space above" value={format?.spaceBefore ?? style?.spaceBefore ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => set("spaceBefore", value)} />
    </PanelControlRow>
    <PanelControlRow label="Space below">
      <PanelNumber label="Space below" value={format?.spaceAfter ?? style?.spaceAfter ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => set("spaceAfter", value)} />
    </PanelControlRow>
    <PanelControlRow label="Line height" detail="Unitless multiplier">
      <PanelNumber label="Line height" value={format?.lineHeight ?? style?.lineHeight ?? 1.3} min={0.8} max={3} step={0.05} flush onchange={(value) => set("lineHeight", value)} />
    </PanelControlRow>
    <PanelControlRow label="Indent">
      <PanelNumber label="Indent" value={format?.indent ?? style?.indent ?? 0} unit="px" min={0} max={200} step={1} flush onchange={(value) => set("indent", value)} />
    </PanelControlRow>
  </PanelControlGroup>
</PanelSection>
