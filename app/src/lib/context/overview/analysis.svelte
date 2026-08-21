<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { analysis, lastRunOf, limitIn } from "$mock-capabilities/analysis";
  import { PEOPLE } from "$mock-capabilities/cast";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The analysis itself: what it is called, whether it is saved, what it last
   * produced.
   *
   * `docs/screen-panel-views/context/overview/analysis.md` is the specification.
   *
   * **Result describes a run, not a definition.** Nothing about a result is
   * stored — it is a projection of running the definition against the variables
   * as they are now — which is why the section can only ever describe the most
   * recent evaluation, and why *Run again* refreshes the door rather than saving
   * anything.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const it = $derived(analysis(analysisId).current);
  const lastRun = $derived(lastRunOf(analysisId));
  const run = $derived(lastRun.current);
  const limit = $derived(limitIn(analysisId).current);

  let titleDraft = $state("");

  const author = $derived(PEOPLE.find((person) => person.name === it.updatedBy));
</script>

<Panel title="Overview">
  {#snippet actions()}
    <PanelButton
      label="Run again"
      icon={RefreshCw}
      tone="primary"
      onclick={() => void lastRun.refresh()}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Title" stacked>
      <PanelEditableText
        value={titleDraft || it.title}
        label="Analysis title"
        onchange={(next: string) => (titleDraft = next)}
      />
    </PanelField>
  </PanelFields>

  <!--
    A chart needs a description more than most things do — the title says what is
    plotted, the description says why — so its absence is stated rather than
    drawn as an empty field.
  -->
  <PanelNote tone="gap">
    The analysis record has no description, so the reason for the chart has
    nowhere to live yet.
  </PanelNote>

  <PanelSection title="Saved">
    <PanelChip tone={it.state === "Saved" ? "success" : "attention"}>
      {it.state} · revision {it.revision}
    </PanelChip>
    <PanelNote>
      Saving is revision-CAS on the current state. Undo covers unsaved builder
      actions only; there is no change-set history behind this.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Result">
    <PanelFields>
      <PanelField label="Rows" mono>{run.rows} of {run.of}</PanelField>
      <PanelField label="Limit" mono>{limit === null ? "None" : limit.keep}</PanelField>
      <PanelField label="Evaluated" mono>{run.ran}</PanelField>
    </PanelFields>
    <PanelNote>
      Results are replaceable projections rather than resources. Nothing here is
      stored, so this describes the most recent run and nothing before it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Attribution" open={false}>
    <PanelFields>
      <!-- The record names who last changed it; there is no creator on it. -->
      <PanelField label="Updated by">
        {#if author}
          <PanelLink
            label={it.updatedBy}
            title="{it.updatedBy} — person"
            onselect={() =>
              mockWorkbench.inspect("collaboration.person", { kind: "person", id: author.id })}
          />
        {:else}
          {it.updatedBy}
        {/if}
      </PanelField>
      <PanelField label="Updated" mono>{it.updated}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
