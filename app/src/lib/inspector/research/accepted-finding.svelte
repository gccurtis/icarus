<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import FileText from "@lucide/svelte/icons/file-text";
  import Minus from "@lucide/svelte/icons/minus";
  import Undo2 from "@lucide/svelte/icons/undo-2";
  import X from "@lucide/svelte/icons/x";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { resourceFor } from "$mock-capabilities/joins";
  import { finding, thread, type Bearing } from "$mock-capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A conclusion the project has adopted: retrievable everywhere, and no longer
   * editable in place.
   *
   * `docs/screen-panel-views/inspector/research/accepted-finding.md` is the
   * specification. The two chips at the top say the same thing from two angles —
   * it is accepted, and it is retrievable — because being in the lattice is the
   * whole of what acceptance buys.
   *
   * **Nothing here is an editor.** The proposal lens carries the title and body
   * editors; once accepted, what the project retrieves and what this panel shows
   * have to be the same text, so changing it is a withdrawal rather than a
   * keystroke.
   */
  let { findingId }: { findingId?: string } = $props();

  const view = viewState();

  const id = $derived(findingId ?? view.selection?.id ?? "f-relay");

  const record = $derived(finding(id).current);
  const origin = $derived(thread(record.threadId).current);

  const asResource = $derived(resourceFor(record.title));

  let withdrawn = $state(false);

  /** A neutral bearing is the absence of a claim, so it is not drawn as one. */
  const BEARING_ICON = { Supports: Check, Contradicts: X, Neutral: Minus };
  const BEARING_TONE = { Supports: "success", Contradicts: "danger", Neutral: "default" } as const;
  const bearingSub = (link: Bearing) => (link.bearing === "Neutral" ? undefined : link.bearing);

  const lensFor = (link: Bearing) =>
    link.kind === "hypothesis" ? "research.hypothesis" : "research.question";

  const captured = (capture: "excerpt" | "locator") =>
    capture === "excerpt" ? "Excerpt copied on accept" : "Locator only — it points, and can rot";
</script>

<Panel title={record.title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: origin.title, key: "research.thread" }, { label: record.title }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "thread", id: record.threadId });
      }}
    />
  {/snippet}

  <PanelSection title="Finding" flush>
    <PanelFields>
      <PanelField label="State">
        <PanelChip tone={withdrawn ? "danger" : "success"}>
          {withdrawn ? "Withdrawn" : "Accepted"}
        </PanelChip>
      </PanelField>
      <PanelField label="Retrieval">
        <PanelChip tone={withdrawn || !record.inLattice ? "inactive" : "active"}>
          {withdrawn || !record.inLattice ? "Out of the lattice" : "In the lattice"}
        </PanelChip>
      </PanelField>

      <PanelField label="Title" stacked>{record.title}</PanelField>
      {#if record.acceptedBy}
        <PanelField label="Accepted by">{record.acceptedBy}</PanelField>
      {/if}
      {#if record.acceptedAt}
        <PanelField label="When">{record.acceptedAt}</PanelField>
      {/if}
    </PanelFields>

    <PanelNote>
      Accepted and in the lattice are one fact from two angles: the project has
      adopted it, so anything in the project can retrieve it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Body" flush>
    <PanelFields>
      <PanelField label="Claim" stacked>{record.body}</PanelField>
    </PanelFields>
  </PanelSection>

  <!-- What it rests on, and how well. Qualifying rather than the reason for opening it. -->
  <PanelSection title="Standing on" count={record.standingOn.length} open={false} flush>
    {#each record.standingOn as citation (citation.sourceId)}
      <PanelRow
        title="{citation.title} · {citation.locator}"
        sub={captured(citation.capture)}
        icon={FileText}
        onselect={() =>
          view.inspect("research.source", { kind: "source", id: citation.sourceId })}
      />
    {/each}

    <PanelNote>
      An excerpt is copied on accept and survives the source changing. A locator
      only points, and can rot.
    </PanelNote>

    <PanelNote tone="gap">
      A source reference still names the obsolete researchMessages table rather
      than the generic messages table.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Bears on" count={record.bearsOn.length} open={false} flush>
    {#each record.bearsOn as link (link.id)}
      <PanelRow
        title="{link.ref} · {link.title}"
        sub={bearingSub(link)}
        icon={BEARING_ICON[link.bearing]}
        tone={BEARING_TONE[link.bearing]}
        onselect={() =>
          view.inspect(lensFor(link), { kind: link.kind, id: link.ref.toLowerCase() })}
      />
    {/each}
  </PanelSection>

  <!-- Retraction is set apart from everything it would retract. -->
  <Separator />

  <PanelSection title="Actions" flush>
    <PanelActions>
      <!--
        The project keys its row by an id of its own, so this asks for it by
        name. A finding the project holds no row for is not a resource, and the
        button says so rather than opening whichever row sorts first.
      -->
      <PanelButton
        label="Open as resource"
        icon={FileText}
        disabled={asResource === undefined}
        title={asResource === undefined
          ? "The project holds no resource for this finding"
          : "An accepted finding is a resource of the project"}
        onclick={() =>
          asResource !== undefined &&
          view.inspect("project.resource", { kind: "resource", id: asResource })}
      />
      <PanelButton
        label="Withdraw"
        icon={Undo2}
        tone="danger"
        disabled={withdrawn}
        title={withdrawn ? "Already withdrawn" : "Retract it from the lattice"}
        onclick={() => (withdrawn = true)}
      />
    </PanelActions>

    <PanelNote tone="gap">
      Withdrawal semantics are undecided. A finding that has been retrieved into
      a generated block, or cited by another finding, cannot simply vanish.
    </PanelNote>
  </PanelSection>
</Panel>
