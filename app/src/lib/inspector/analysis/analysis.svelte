<script lang="ts">
  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { analysis, lastRunOf } from "$mock-capabilities/analysis";

  /**
   * The analysis itself — the lens the inspector shows while nothing inside the
   * builder is selected.
   *
   * `docs/screen-panel-views/inspector/analysis/analysis.md` is the
   * specification.
   *
   * **Nothing selected is a band, not a blank panel.** An empty builder is the
   * emptiest screen in the application; without the sentence it offers no
   * instruction at all.
   *
   * **Result reads the evaluator, not the record.** Nothing about a result is
   * stored, so these two numbers are a fresh run rather than a saved answer —
   * which is why the band is provenance at the bottom and arrives shut.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const run = $derived(lastRunOf(analysisId).current);

  const rows = (count: number) => count.toLocaleString("en-GB");

  /** The state and the revision together: either alone says nothing about staleness. */
  const saved = $derived(`${record.state} · revision ${record.revision}`);
</script>

<!--
  No crumbs. The analysis is the outermost thing the inspector can be on, and a
  trail of one entry is a trail that leads nowhere.
-->
<Panel title={record.title}>
  <!-- The head of the lens has no heading: the title already names the analysis. -->
  <PanelFields>
    <PanelField label="Title">{record.title}</PanelField>
    <PanelField label="Saved">{saved}</PanelField>
  </PanelFields>

  <PanelSection title="Nothing selected">
    <PanelNote>
      Drag a field from Variables onto X or Y, and click a bar to see what is underneath it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Result" count="{rows(run.rows)} of {rows(run.of)}" open={false}>
    <PanelFields>
      <PanelField label="Rows" mono>{rows(run.rows)} of {rows(run.of)}</PanelField>
      <PanelField label="Evaluated">{run.ran}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
