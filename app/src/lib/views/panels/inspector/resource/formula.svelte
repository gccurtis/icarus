<script lang="ts">
  import FunctionSquare from "@lucide/svelte/icons/function-square";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { documentRecord, inlineFormula } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A formula inside running text.
   *
   * `docs/screen-panel-views/inspector/resource/formula.md` is the
   * specification. An inline formula reads as ordinary prose on the page —
   * nothing about it pops out of the document — so everything you might want to
   * know about it is here instead.
   *
   * **There is no refresh and no stale marker.** A formula reads its value when
   * it runs, so what is on the page is what the variable holds; a control
   * offering to bring it up to date would be offering to fix a state that cannot
   * happen.
   */
  let {
    documentId = "r-memo",
    formulaId = "if-1"
  }: { documentId?: string; formulaId?: string } = $props();

  const view = viewState();

  const doc = $derived(documentRecord(documentId).current);
  const formula = $derived(inlineFormula(formulaId).current);

  let expression = $state<string | undefined>(undefined);
  const shownExpression = $derived(expression ?? formula.expression);
</script>

<Panel title="Inline formula">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: doc.title, key: "resource.document" }, { label: "Formula" }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "resource", id: documentId });
      }}
    />
  {/snippet}

  <!-- The rendered result first: it is how a reader recognises which formula this is. -->
  <PanelFields>
    <PanelField label="Shows" mono>{formula.shows}</PanelField>
  </PanelFields>

  <PanelSection title="Formula" flush>
    <PanelFields>
      <PanelField label="Expression" stacked>
        <PanelEditableText
          label="Expression"
          value={shownExpression}
          mono
          onchange={(next) => (expression = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelActions>
      <PanelButton
        label="Open variable"
        icon={FunctionSquare}
        title={formula.variable}
        onclick={() =>
          view.inspect("analysis.variable", { kind: "variable", id: formula.variable })}
      />
    </PanelActions>
  </PanelSection>

  <PanelSection title="Value" flush>
    <PanelFields>
      <PanelField label="Type">{formula.type}</PanelField>
      <PanelField label="Read">{formula.readsWhen}</PanelField>
    </PanelFields>

    <PanelNote>
      There is no cached copy to fall behind, which is why nothing here is marked
      stale and there is no refresh.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Format" open={false} flush>
    <PanelFields>
      <PanelField label="Display" mono>{formula.displayFormat}</PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      The format language is shared with the spreadsheet. It has to stay one
      language, or the same number formats differently in a document and a grid.
    </PanelNote>
  </PanelSection>
</Panel>
