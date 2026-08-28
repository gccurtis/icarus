<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Minus from "@lucide/svelte/icons/minus";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { project } from "$capabilities/project";
  import { bearingOn, hypothesis } from "$capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One idea being tested, and the evidence on both sides.
   *
   * `docs/screen-panel-views/inspector/research/hypothesis.md` is the
   * specification. The title is the reference — `H-3` — because that is how the
   * hypothesis is named wherever else it appears, and the statement is a
   * sentence rather than a name.
   *
   * **Assessment is a human judgment.** It is never calculated from the count of
   * supporting and contradicting findings, and this panel says so under the
   * field, because a screen showing both a tally and an assessment invites
   * exactly that inference.
   */
  let { hypothesisId = "h-3" }: { hypothesisId?: string } = $props();

  const view = viewState();

  const record = $derived(hypothesis(hypothesisId).current);
  const evidence = $derived(bearingOn(hypothesisId).current);

  const ASSESSMENT = { Testing: "attention", Supported: "success", Refuted: "danger" } as const;

  const BEARING_ICON = { Supports: Check, Contradicts: X, Neutral: Minus };
  const BEARING_TONE = { Supports: "success", Contradicts: "danger", Neutral: "default" } as const;
</script>

<Panel title={record.ref}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: project().current.name, key: "project.project" }, { label: record.ref }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "project", id: view.project });
      }}
    />
  {/snippet}

  <PanelSection title="Hypothesis" flush>
    <PanelFields>
      <PanelField label="Statement" stacked>{record.statement}</PanelField>
      <PanelField label="Assessment">
        <PanelChip tone={ASSESSMENT[record.assessment]}>{record.assessment}</PanelChip>
      </PanelField>
      <PanelField label="Confidence" mono>{record.confidence.toFixed(2)}</PanelField>
    </PanelFields>

    <PanelNote>
      The assessment is set by a person. It is never a tally of the supporting
      and contradicting findings below.
    </PanelNote>

    <PanelNote tone="gap">
      Who set the confidence, and when, is not recorded. A bare 0.70 with no
      author is not interpretable.
    </PanelNote>
  </PanelSection>

  <!--
    Both sides in one list rather than two. Splitting them would make the
    direction a heading rather than a property of each link, which is the
    mistake the note at the end exists to prevent.
  -->
  <PanelSection title="Evidence" count={evidence.length} flush>
    {#each evidence as link (link.id)}
      <PanelRow
        title={link.title}
        sub={link.bearing}
        meta={link.ref}
        icon={BEARING_ICON[link.bearing]}
        tone={BEARING_TONE[link.bearing]}
        onselect={() =>
          view.inspect("research.accepted-finding", {
            kind: "finding",
            id: link.ref.toLowerCase()
          })}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Note" open={false} flush>
    <PanelNote>
      Bearing lives on each finding-to-hypothesis relationship, not on the
      finding — the same finding can bear differently on different hypotheses.
    </PanelNote>
  </PanelSection>
</Panel>
