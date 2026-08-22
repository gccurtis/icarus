<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import FileText from "@lucide/svelte/icons/file-text";
  import Minus from "@lucide/svelte/icons/minus";
  import X from "@lucide/svelte/icons/x";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { finding, thread, type Bearing } from "$mock-capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A conclusion offered for acceptance: still editable, not yet part of the
   * project.
   *
   * `docs/screen-panel-views/inspector/research/proposed-finding.md` is the
   * specification. This is the lens where a conversation becomes knowledge, so
   * the panel is built as a review — read it, fix it, decide — and the title and
   * the body are both editable before the decision rather than after it. What
   * you accept is what enters the lattice.
   *
   * **Accept is its own section.** It writes the finding and its links together
   * and makes them retrievable across the project, which is a durable act with a
   * wide blast radius rather than one button among four.
   */
  let { findingId = "f-nostudy" }: { findingId?: string } = $props();

  const view = viewState();

  const record = $derived(finding(findingId).current);
  const origin = $derived(thread(record.threadId).current);

  /** The edits held before the decision. Neither exists in the model yet. */
  let retitled = $state<string | undefined>(undefined);
  let rewritten = $state<string | undefined>(undefined);
  const title = $derived(retitled ?? record.title);
  const body = $derived(rewritten ?? record.body);

  let decided = $state<"accepted" | "dismissed" | undefined>(undefined);
  const stateLabel = $derived(
    decided === "accepted" ? "Accepted" : decided === "dismissed" ? "Dismissed" : "Proposed"
  );
  const stateTone = $derived(
    decided === "accepted" ? "success" : decided === "dismissed" ? "inactive" : "attention"
  );

  /** A neutral bearing is the absence of a claim, so it is not drawn as one. */
  const BEARING_ICON = { Supports: Check, Contradicts: X, Neutral: Minus };
  const BEARING_TONE = { Supports: "success", Contradicts: "danger", Neutral: "default" } as const;
  const bearingSub = (link: Bearing) => (link.bearing === "Neutral" ? undefined : link.bearing);

  const lensFor = (link: Bearing) =>
    link.kind === "hypothesis" ? "research.hypothesis" : "research.question";
</script>

<Panel {title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: origin.title, key: "research.thread" }, { label: title }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "thread", id: record.threadId });
      }}
    />
  {/snippet}

  <PanelSection title="Finding" flush>
    <PanelFields>
      <PanelField label="State"><PanelChip tone={stateTone}>{stateLabel}</PanelChip></PanelField>
      <PanelField label="Title" stacked>
        <PanelEditableText
          label="Title"
          value={title}
          disabled={decided !== undefined}
          onchange={(next) => (retitled = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      A proposed finding has no state in the model at all. Proposed, accepted and
      dismissed have to exist before any of this can ship.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Body" flush>
    <PanelFields>
      <PanelField label="Claim" stacked>
        <PanelEditableText
          label="Claim"
          value={body}
          multiline
          disabled={decided !== undefined}
          onchange={(next) => (rewritten = next)}
        />
      </PanelField>
    </PanelFields>

    <PanelNote>
      What you accept is what enters the lattice, so the edit happens before
      acceptance rather than after it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Standing on" count={record.standingOn.length} flush>
    {#each record.standingOn as citation (citation.sourceId)}
      <PanelRow
        title={citation.title}
        sub={citation.locator}
        icon={FileText}
        onselect={() =>
          view.inspect("research.source", { kind: "source", id: citation.sourceId })}
      />
    {/each}

    <PanelNote>
      A finding is a conclusion rather than a quotation, so these are the
      evidence for it rather than the thing itself. They can be lattice sources,
      web sources, or both.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Bears on" count={record.bearsOn.length} flush>
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

  <!-- The decision is set apart from everything it is a decision about. -->
  <Separator />

  <PanelSection title="Accept" flush>
    <PanelActions>
      <PanelButton
        label="Accept finding"
        icon={Check}
        tone="primary"
        disabled={decided !== undefined}
        title={decided === undefined ? undefined : `Already ${decided}`}
        onclick={() => (decided = "accepted")}
      />
      <PanelButton
        label="Dismiss"
        icon={X}
        tone="danger"
        disabled={decided !== undefined}
        title={decided === undefined ? undefined : `Already ${decided}`}
        onclick={() => (decided = "dismissed")}
      />
    </PanelActions>

    <PanelNote>
      Accepting writes the finding and its links together, and makes it
      retrievable across the project.
    </PanelNote>
  </PanelSection>
</Panel>
