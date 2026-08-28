<script lang="ts">
  import Brackets from "@lucide/svelte/icons/brackets";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import {
    namedRangesIn,
    rangeSelection,
    type NamedRange
  } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Names that mean something inside this spreadsheet only.
   *
   * `docs/screen-panel-views/context/resource/named-ranges.md` is the
   * specification.
   *
   * **This is not the project's Variables view and must never read as one.** Both
   * are names you can write in a formula; a named range resolves in this
   * spreadsheet and nowhere else, a variable resolves everywhere. One list would
   * make that difference invisible at exactly the moment it matters — while
   * someone is typing the name into a cell.
   *
   * **Name this range acts on the selection and opens the lens.** Naming is where
   * the scope, the range and the name are settled, and that is the named-range
   * lens rather than a form grown here.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  const ranges = $derived(namedRangesIn(spreadsheetId).current);

  /** The block the action row acts on: the grid's selection, as a range. */
  const selection = $derived(
    rangeSelection(spreadsheetId, view.selection?.id ?? "A1").current
  );

  /** Zero is worth a word rather than a digit — an unused name is the one to question. */
  const uses = (range: NamedRange) =>
    range.referencedByFormulas === 0 ? "unused" : `${range.referencedByFormulas} uses`;
</script>

<Panel title="Named ranges">
  {#snippet actions()}
    <PanelButton
      label="Name this range"
      icon={Plus}
      tone="primary"
      title={`Names ${selection.a1}, the current selection`}
      onclick={() => view.inspect("resource.named-range", { kind: "range", id: selection.a1 })}
    />
  {/snippet}

  <!--
    The section is headed "This spreadsheet" rather than "Names": the scope is
    the whole claim this view makes, and it belongs in the heading rather than in
    a sentence underneath it.
  -->
  <PanelSection title="This spreadsheet" count={ranges.length} flush>
    {#each ranges as range (range.id)}
      <PanelRow
        title={range.name}
        sub={range.range}
        meta={uses(range)}
        icon={Brackets}
        onselect={() =>
          view.inspect("resource.named-range", { kind: "named-range", id: range.name })}
      />
    {/each}
  </PanelSection>

  <PanelNote>
    These names resolve here and nowhere else. A project variable resolves in
    every resource, and the two are kept apart so that the difference is visible
    in the formula you are about to write.
  </PanelNote>

  <PanelNote tone="gap">
    A named range whose cells are deleted has no defined behaviour. It either
    becomes #REF! everywhere it is used or it is repaired, and the model does not
    say which.
  </PanelNote>
</Panel>
