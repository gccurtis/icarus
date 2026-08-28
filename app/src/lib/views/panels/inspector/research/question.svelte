<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Minus from "@lucide/svelte/icons/minus";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { project } from "$capabilities/project";
  import { bearingOn, question, type Bearing } from "$capabilities/research";
  import { viewState } from "$model/client/view-state";

  /**
   * One thing the project wants to know, and what bears on it.
   *
   * `docs/screen-panel-views/inspector/research/question.md` is the
   * specification. A question outlives any thread that works on it, so this lens
   * is about the question and never about the conversation.
   *
   * **The title is the reference.** `Q-14` is how the question is named in every
   * other panel in this subject, and a heading carrying the sentence would
   * repeat the first field underneath it.
   *
   * **Status is set by a person.** Nothing here derives it, and the note says
   * so — a question with three accepted findings can still be open.
   */
  let { questionId = "q-14" }: { questionId?: string } = $props();

  const view = viewState();

  const record = $derived(question(questionId).current);
  const bearings = $derived(bearingOn(questionId).current);

  const hypotheses = $derived(bearings.filter((link) => link.kind === "hypothesis"));
  const findings = $derived(bearings.filter((link) => link.kind === "finding"));

  const STATUS = {
    Open: "neutral",
    Investigating: "active",
    Answered: "success"
  } as const;

  /** A neutral bearing is the absence of a claim, so it is not drawn as one. */
  const BEARING_ICON = { Supports: Check, Contradicts: X, Neutral: Minus };
  const BEARING_TONE = { Supports: "success", Contradicts: "danger", Neutral: "default" } as const;
  const bearingSub = (link: Bearing) => (link.bearing === "Neutral" ? undefined : link.bearing);

  const trail = $derived(
    record.parentId !== undefined && record.parentText !== undefined
      ? [{ label: record.parentText, key: record.parentId }, { label: record.ref }]
      : [{ label: project().current.name }, { label: record.ref }]
  );
</script>

<Panel title={record.ref}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={(key) => view.inspect("research.question", { kind: "question", id: key })}
    />
  {/snippet}

  <PanelSection title="Question" flush>
    <PanelFields>
      <PanelField label="Text" stacked>{record.text}</PanelField>
      <PanelField label="Status">
        <PanelChip tone={STATUS[record.status]}>{record.status}</PanelChip>
      </PanelField>
      {#if record.parentId && record.parentText}
        {@const parentId = record.parentId}
        <PanelField label="Parent" stacked>
          <PanelLink
            label={record.parentText}
            title="Open the question this one sits under"
            onselect={() =>
              view.inspect("research.question", { kind: "question", id: parentId })}
          />
        </PanelField>
      {/if}
    </PanelFields>

    <PanelNote>
      Status is set by a person. Nothing derives it, and nothing should: a
      question with three accepted findings can still be open.
    </PanelNote>
  </PanelSection>

  <!-- The ideas offered as answers. Open, because they are what the question is for. -->
  <PanelSection title="Linked hypotheses" count={hypotheses.length} flush>
    {#each hypotheses as link (link.id)}
      <PanelRow
        title={link.title}
        meta={link.ref}
        icon={Lightbulb}
        onselect={() =>
          view.inspect("research.hypothesis", {
            kind: "hypothesis",
            id: link.ref.toLowerCase()
          })}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Accepted findings" count={findings.length} open={false} flush>
    {#each findings as link (link.id)}
      <PanelRow
        title={link.title}
        sub={bearingSub(link)}
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

    <PanelNote tone="gap">
      A finding can bear on a question directly or through a hypothesis. Whether
      this section shows both, and how it tells them apart, is unsettled.
    </PanelNote>
  </PanelSection>
</Panel>
