<script lang="ts">
  import {
    Panel,
    PanelCode,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { compiledFor, lastRunOf } from "$capabilities/analysis";

  /**
   * What the builder compiled to, and what the last run of it cost.
   *
   * `docs/screen-panel-views/context/analysis/formula.md` is the specification.
   * A diagnostic: it answers "why did I get that" when the chart is not what was
   * expected.
   *
   * **The expression is read-only deliberately.** Editing it would break the
   * round trip back to the builder, so this is a way of reading the definition
   * rather than a second way of authoring it.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const compiled = $derived(compiledFor(analysisId).current);
  const run = $derived(lastRunOf(analysisId).current);
</script>

<Panel title="Formula">
  <PanelSection title="Compiled">
    <PanelCode>{compiled}</PanelCode>
    <PanelNote>
      The expression the builder produced, from the fields, filters, sort and limit as they stand.
    </PanelNote>
    <PanelNote tone="gap">
      There is no parser from the formula language back into the definition, so this cannot become
      a second way to author. Read-only is the whole of it.
    </PanelNote>
  </PanelSection>

  <!--
    Cost rather than answer, so it arrives shut. Rows carries both numbers: the
    limit does not bite here, and "6" on its own would read as the whole result.
  -->
  <PanelSection title="Evaluation" open={false}>
    <PanelFields>
      <PanelField label="Ran" mono>{run.ran}</PanelField>
      <PanelField label="Rows" mono>{run.rows} of {run.of}</PanelField>
      <PanelField label="Duration" mono>{run.duration}</PanelField>
    </PanelFields>
    <PanelNote>
      Nothing about a result is stored, so this describes the most recent run and nothing before it.
    </PanelNote>
  </PanelSection>
</Panel>
