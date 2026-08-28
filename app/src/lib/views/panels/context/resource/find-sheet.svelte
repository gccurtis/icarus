<script lang="ts">
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelChoice,
    PanelNote,
    PanelRow,
    PanelSearch
  } from "$components/authored/panel";
  import { findInSheet } from "$capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * Search across this spreadsheet.
   *
   * `docs/screen-panel-views/context/resource/find-sheet.md` is the
   * specification. A grid holds two layers of text — the formulas that are stored
   * and the values they evaluate to — and searching both at once is usually the
   * wrong answer, so the layer is a chip and every hit says which layer it came
   * out of.
   *
   * **There is no replace.** Replacing inside a formula and replacing inside text
   * are different operations and one of them can break a model, so the panel does
   * not offer a single control that would do either.
   */
  let { spreadsheetId = "r-cost" }: { spreadsheetId?: string } = $props();

  const view = viewState();

  let query = $state("");
  let layer = $state<"all" | "formula" | "value">("all");

  const LAYERS = [
    { value: "all", label: "Everything" },
    { value: "formula", label: "Formulas" },
    { value: "value", label: "Values" }
  ] as const;

  /** The door runs the two passes; the chips choose which of them is being read. */
  const hits = $derived(findInSheet(spreadsheetId, query).current);

  const needle = $derived(query.trim().toLowerCase());

  /**
   * The text filter is over what the door returned. The door is given the query
   * and, until the pass is real, answers every query alike — and a field that
   * narrows nothing reads as broken.
   */
  const shown = $derived(
    hits
      .filter((hit) => layer === "all" || hit.layer === layer)
      .filter(
        (hit) =>
          hit.content.toLowerCase().includes(needle) || hit.address.toLowerCase().includes(needle)
      )
  );
</script>

<Panel title="Find">
  <!-- The field contains what it searches, so its scope is the markup rather than a convention. -->
  <PanelSearch
    placeholder="Search formulas and values"
    matched={shown.length}
    total={hits.length}
    empty="No cell matches."
    bind:value={query}
    flush
  >
    <PanelChoice
      label="Search"
      value={layer}
      options={LAYERS}
      onchange={(next) => (layer = next as typeof layer)}
    />

    {#each shown as hit (hit.id)}
      <PanelRow
        title={hit.address}
        sub={hit.content}
        meta={hit.layer === "formula" ? "fx" : "text"}
        icon={hit.layer === "formula" ? SquareFunction : Type}
        onselect={() =>
          view.inspect(
            hit.layer === "formula" ? "resource.cell-with-formula" : "resource.cell",
            { kind: "cell", id: hit.address }
          )}
      />
    {/each}
  </PanelSearch>

  <PanelNote>
    Whether replace belongs here at all is unsettled, so it is absent rather than
    half-drawn.
  </PanelNote>
</Panel>
