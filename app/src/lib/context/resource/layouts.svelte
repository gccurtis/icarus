<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Pencil from "@lucide/svelte/icons/pencil";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    Panel,
    PanelButton,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelThumb,
    PanelThumbs
  } from "$lib/unique-components/panel";
  import { layout, layoutsIn, slide } from "$mock-capabilities/resource";

  /**
   * Which layout this slide uses, and what else it could use.
   *
   * `docs/screen-panel-views/context/resource/layouts.md` is the specification.
   * This is applying a layout, from the slide's side; editing one is the layout
   * subscreen, which **Edit layout** enters.
   *
   * The alternatives are cards rather than rows because a layout is a shape and a
   * shape should be seen. Each card draws one bar per placeholder, so the
   * pictures differ from each other for the reason they actually differ.
   */
  let { deckId = "r-board", slideId = "sl-4" }: { deckId?: string; slideId?: string } = $props();

  const current = $derived(slide(slideId).current);
  const layouts = $derived(layoutsIn(deckId).current);

  /** Applying is held here; no door writes a slide's layout reference. */
  let applied = $state<string | undefined>(undefined);
  let picked = $state<string | undefined>(undefined);

  const currentId = $derived(applied ?? current.layoutId);
  const currentLayout = $derived(layout(currentId).current);
  const others = $derived(layouts.filter((candidate) => candidate.id !== currentId));

  const RESET_GATE =
    "Reset needs a slide element's placeholder to resolve to exactly one role, and a placeholder has no stable key.";

  const LAYOUT_RAIL_GATE =
    "The layout rail is not a subscreen, so the deck's rail does not offer resource.layout-layouts to select.";
</script>

<Panel title="Layouts">
  {#snippet actions()}
    <PanelButton
      label="Apply"
      icon={Check}
      tone="primary"
      disabled={picked === undefined}
      onclick={() => {
        applied = picked;
        picked = undefined;
      }}
    />
    <PanelButton label="Reset to layout" icon={RotateCcw} disabled title={RESET_GATE} />
    <!--
      Entering the subscreen is a move of the whole rail, not a modal: the layout
      views replace the slide views for as long as a layout is being edited.
    -->
    <PanelButton label="Edit layout" icon={Pencil} disabled title={LAYOUT_RAIL_GATE} />
  {/snippet}

  <PanelSection title="Current">
    <PanelFields>
      <PanelField label="Layout">{currentLayout.name}</PanelField>
      <PanelField label="Contributes">
        {currentLayout.placeholders} placeholders · {currentLayout.locked} locked
      </PanelField>
      <PanelField label="Background">{currentLayout.backgroundSource}</PanelField>
      <PanelField label="Used by">{currentLayout.usedBy} slides</PanelField>
    </PanelFields>
  </PanelSection>

  <!-- `flush`, because `PanelThumbs` already carries the panel's padding. -->
  <PanelSection title="Deck layouts" count={others.length} flush>
    <PanelThumbs across={2}>
      {#each others as candidate (candidate.id)}
        <PanelThumb
          caption={candidate.name}
          meta={candidate.locked > 0 ? `${candidate.locked} locked` : undefined}
          lines={candidate.placeholders}
          selected={candidate.id === picked}
          onselect={() => (picked = candidate.id)}
        />
      {/each}
    </PanelThumbs>
  </PanelSection>

  <PanelNote>
    One bar per placeholder. Choosing a card arms <strong>Apply</strong>; it does not
    change the slide until Apply is pressed.
  </PanelNote>

  <PanelNote tone="gap">
    Reset stays gated. Two placeholders sharing a role cannot be told apart, so
    there is no defined element to reset a slide's copy back to.
  </PanelNote>
</Panel>
