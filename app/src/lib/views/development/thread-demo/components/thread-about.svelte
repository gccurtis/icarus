<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Globe from "@lucide/svelte/icons/globe";
  import Library from "@lucide/svelte/icons/library";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";

  import {
    Panel,
    PanelActor,
    PanelButton,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSkeleton
  } from "$components/authored/panel";

  /**
   * What the thread is about, beside the thread.
   *
   * **This is the "additional information to support it" half**, and it is the
   * shape Research already specifies: the thread's job, who is answering, what
   * it may look at, what it has read this turn, and what it has produced. A
   * thread on its own is a transcript. A thread with this next to it is a piece
   * of work with a subject.
   *
   * **The counts are live, and that is the point of putting them here.**
   * Accepting a finding in the middle of the plane moves *Accepted* in the
   * panel, which is what says the decision went somewhere rather than dimming a
   * button. A static summary would have taught the opposite lesson.
   *
   * **`PanelSkeleton` is used only where the wait is bounded.** Its own rule is
   * that a skeleton which never resolves is the worst loading state there is, so
   * it appears for the incoming turn's sources — a wait this page ends on a
   * timer — and nowhere else. Nothing on this page is permanently pretending to
   * load.
   *
   * **There is no New thread button**, even though the specification's panel has
   * one. A control that cannot ever work should not be drawn, and this page has
   * exactly one thread.
   */
  let {
    title,
    turns,
    accepted,
    proposed,
    sourcesUsed,
    sources,
    pending,
    onrename,
    onclear,
    onopen
  }: {
    title: string;
    turns: number;
    accepted: number;
    proposed: number;
    /** Distinct sources across every turn, not a sum of per-turn counts. */
    sourcesUsed: number;
    /** What the newest reply read. Empty is a fact worth saying, not a blank. */
    sources: readonly { name: string; kind: string }[];
    /** A reply is on its way, so this turn's sources are not known yet. */
    pending: boolean;
    onrename: (next: string) => void;
    onclear: () => void;
    onopen: (what: string) => void;
  } = $props();
</script>

<Panel {title}>
  {#snippet actions()}
    <PanelButton
      label="Clear the thread"
      icon={RotateCcw}
      title="Empty it, to see what a thread with nothing in it says"
      onclick={onclear}
    />
  {/snippet}

  <PanelSection title="This thread">
    <PanelFields>
      <PanelField label="Title" stacked>
        <PanelEditableText value={title} label="Thread title" onchange={onrename} />
      </PanelField>
      <PanelField label="Job">Answer one question</PanelField>
      <PanelField label="Anchored to">
        <PanelLink
          label="Q-14 · Why did Feeder 12 fail twice?"
          title="Open the question"
          onselect={() => onopen("Q-14 · Why did Feeder 12 fail twice?")}
        />
      </PanelField>
      <PanelField label="Messages" mono>{turns}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Asking">
    <PanelActor
      name="Grid Analyst"
      kind="agent"
      role="Reads field reports and relay logs."
      onselect={() => onopen("Grid Analyst")}
    />
  </PanelSection>

  <!--
    Outside the section rather than in it. A `PanelSection` that is not flush
    already insets its children by the panel's gutter, and a `PanelNote` carries
    the same gutter itself — nested, the sentence lands 24px in and reads as a
    footnote to the avatar rather than to the section.
  -->
  <PanelNote>Set for the whole thread, not per message. There is no per-turn switch.</PanelNote>

  <PanelSection title="Looking in" flush>
    <PanelRow
      title="Field reports 2024–25"
      sub="Resource set"
      meta="96"
      icon={Library}
      onselect={() => onopen("Field reports 2024–25")}
    />
    <PanelRow title="Web" sub="Used when a message asks for it" icon={Globe} />
  </PanelSection>

  <PanelSection title="This turn read" count={pending ? undefined : sources.length} flush>
    {#if pending}
      <PanelSkeleton shape="rows" count={2} />
    {:else if sources.length === 0}
      <PanelNote>Nothing was read for this turn.</PanelNote>
    {:else}
      {#each sources as source (source.name)}
        <PanelRow
          title={source.name}
          sub={source.kind}
          icon={FileText}
          onselect={() => onopen(source.name)}
        />
      {/each}
    {/if}
  </PanelSection>

  <PanelSection title="Produced">
    <PanelFields>
      <PanelField label="Accepted" mono>{accepted}</PanelField>
      <PanelField label="Proposed" mono>{proposed}</PanelField>
      <PanelField label="Sources used" mono>{sourcesUsed}</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    One box, not two. `PanelNote`'s gap tone draws a dashed border and carries no
    margin, so two of them stacked share an edge and read as one badly-drawn box.
    Both gaps are real; they fit in one sentence each.
  -->
  <PanelNote tone="gap">
    Proposed, accepted and dismissed have no state in the model, so these counts move
    because this page is holding them rather than because anything was written. And a
    web source needs a capture rather than a URL — a page that has since changed is no
    longer the source a finding stands on. Nothing here captures one.
  </PanelNote>

  <PanelNote>
    Everything above is what Research specifies beside a thread. It is also the
    argument that a thread is never just the messages: the same list without this
    column is a transcript.
  </PanelNote>
</Panel>
