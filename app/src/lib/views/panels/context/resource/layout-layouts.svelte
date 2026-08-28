<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { layoutsIn } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Every layout in the deck, and which one is being edited.
   *
   * `docs/screen-panel-views/context/resource/layout-layouts.md` is the
   * specification. It is the first rail entry of the layout subscreen and it
   * replaces the slide list, because in this state layouts are what you move
   * between.
   *
   * **The used-by count is on every row.** It is how many slides an edit here
   * will change, which is the one number that decides whether an edit is safe.
   */
  let { deckId = "r-board", layoutId = "ly-two-panes" }: { deckId?: string; layoutId?: string } =
    $props();

  const view = viewState();

  const layouts = $derived(layoutsIn(deckId).current);

  const editingId = $derived(
    view.selection?.kind === "layout" ? view.selection.id : layoutId
  );

  const made = (placeholders: number, locked: number) =>
    placeholders === 0
      ? "No placeholders"
      : locked === 0
        ? `${placeholders} placeholders`
        : `${placeholders} placeholders · ${locked} locked`;

  const MINTS = "No door mints a layout id yet.";
</script>

<Panel title="Layouts">
  {#snippet actions()}
    <PanelButton label="New" icon={Plus} tone="primary" disabled title={MINTS} />
    <PanelButton label="Duplicate" icon={Copy} disabled title={MINTS} />
  {/snippet}

  <PanelSection title="In this deck" count={layouts.length} flush>
    {#each layouts as candidate (candidate.id)}
      <PanelRow
        title={candidate.name}
        sub={made(candidate.placeholders, candidate.locked)}
        meta="{candidate.usedBy} slides"
        icon={LayoutTemplate}
        selected={candidate.id === editingId}
        onselect={() => view.inspect("resource.layout", { kind: "layout", id: candidate.id })}
      />
    {/each}
  </PanelSection>

  <!--
    Deleting is absent rather than disabled: a disabled control promises the
    behaviour exists and is unavailable, and here there is no behaviour to have.
  -->
  <PanelNote tone="gap">
    Deleting a layout has no defined outcome — the slides using it either fall back
    to Blank, or the deletion is refused, or the layout stays as a tombstone. New
    and Duplicate are inert for the same kind of reason: nothing mints a layout id.
  </PanelNote>
</Panel>
