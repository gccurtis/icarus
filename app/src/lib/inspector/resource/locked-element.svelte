<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { layout, lockedElement } from "$mock-capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Content the layout owns and a slide cannot touch — a footer wordmark, a slide
   * number.
   *
   * `docs/screen-panel-views/inspector/resource/locked-element.md` is the
   * specification.
   *
   * **The content is editable because this lens exists only in the layout
   * subscreen.** On a slide the same object is visible and inert, and there it is
   * not selectable at all. The breadcrumb names the layout rather than a slide,
   * so where you are is answered before you try to type.
   */
  let {
    elementId = "le-wordmark",
    layoutId = "ly-two-panes"
  }: { elementId?: string; layoutId?: string } = $props();

  const view = viewState();

  const el = $derived(lockedElement(elementId).current);
  const owner = $derived(layout(layoutId).current);

  let draft = $state<string | undefined>(undefined);
  const content = $derived(draft ?? el.content);

  const fraction = (value: number) => value.toFixed(3);
</script>

<Panel title={el.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: owner.name, key: "resource.layout" }, { label: el.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "layout", id: layoutId });
      }}
    />
  {/snippet}

  <PanelSection title="Content">
    <PanelEditableText
      label="Content"
      value={content}
      onchange={(next: string) => (draft = next)}
    />
  </PanelSection>

  <!-- The owner chip is the point of the section: the frame belongs to the layout. -->
  <PanelSection title="Frame">
    <PanelFields>
      <PanelField label="X" mono>{fraction(el.frame.x)}</PanelField>
      <PanelField label="Y" mono>{fraction(el.frame.y)}</PanelField>
      <PanelField label="Width" mono>{fraction(el.frame.w)}</PanelField>
      <PanelField label="Height" mono>{fraction(el.frame.h)}</PanelField>
      <PanelField label="Owner"><PanelChip tone="attention">{el.owner}</PanelChip></PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Editing">
    <PanelNote>
      Layout-owned, and editable in the layout subscreen only. Every slide on
      {owner.name} draws this and none of them can change it.
    </PanelNote>
  </PanelSection>
</Panel>
