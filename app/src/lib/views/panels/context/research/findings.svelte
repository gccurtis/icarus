<script lang="ts">
  import Lightbulb from "@lucide/svelte/icons/lightbulb";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$components/authored/panel";
  import {
    acceptedElsewhere,
    acceptedIn,
    currentTurn,
    proposedIn,
    thread,
    type Finding
  } from "$capabilities/research";
  import { viewState } from "$model/client/view-state";

  /**
   * The same object in three states: proposed by this turn, accepted in this
   * thread, and accepted somewhere else in the project.
   *
   * `docs/screen-panel-views/context/research/findings.md` is the specification.
   * A finding is a conclusion rather than a quotation, so every row leads with the
   * claim and qualifies it with what it bears on — the passages it stands on are
   * inside the lens.
   *
   * **Proposed sits first and decides nothing.** Accept, Edit and Dismiss are
   * beside the answer in the centre; this is the list of what is waiting, and a
   * row here opens the proposal for that review rather than short-cutting it.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const view = viewState();

  const turn = $derived(currentTurn(threadId).current);
  const proposed = $derived(proposedIn(turn.id).current);
  const accepted = $derived(acceptedIn(threadId).current);
  const elsewhere = $derived(acceptedElsewhere(threadId).current);

  /** Said as the link reads: "Supports H-3". A finding with no links says so. */
  const bearings = (found: Finding) =>
    found.bearsOn.length === 0
      ? "Bears on nothing yet"
      : found.bearsOn.map((link) => `${link.bearing} ${link.ref}`).join(" · ");

  /** Where an outside finding was established. A conclusion with no origin cannot be checked. */
  const from = (found: Finding) => thread(found.threadId).current.title;

  const open = (found: Finding) =>
    view.inspect(
      found.state === "proposed" ? "research.proposed-finding" : "research.accepted-finding",
      { kind: "finding", id: found.id }
    );
</script>

<Panel title="Findings">
  <!--
    The live section: attention rather than success, because these are waiting on
    a person and the tone is the difference between the two states at a glance.
  -->
  <PanelSection title="Proposed here" count={proposed.length} flush>
    {#each proposed as found (found.id)}
      <PanelRow
        title={found.title}
        sub={found.derivation}
        icon={Lightbulb}
        tone="attention"
        onselect={() => open(found)}
      />
    {/each}

    <PanelNote tone="gap">
      Proposed is drawn here and stored nowhere. A finding has no state in the
      model, so nothing tells one awaiting a decision from one already dismissed.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Accepted in this thread" count={accepted.length} flush>
    {#each accepted as found (found.id)}
      <PanelRow
        title={found.title}
        sub={bearings(found)}
        meta={found.acceptedAt}
        icon={Lightbulb}
        tone="success"
        onselect={() => open(found)}
      />
    {/each}
  </PanelSection>

  <!-- Context rather than the reason the panel was open, so it arrives shut. -->
  <PanelSection title="Elsewhere in the project" count={elsewhere.length} open={false} flush>
    {#each elsewhere as found (found.id)}
      <PanelRow
        title={found.title}
        sub={from(found)}
        meta={found.acceptedAt}
        icon={Lightbulb}
        onselect={() => open(found)}
      />
    {/each}

    <PanelNote tone="gap">
      Everything the project has accepted is listed, which is not what this
      section means. "Relevant here" needs a rule before the list can be narrowed
      to it.
    </PanelNote>
  </PanelSection>
</Panel>
