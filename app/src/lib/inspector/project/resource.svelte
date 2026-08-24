<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelFaces,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { members, presenceFor } from "$mock-capabilities/collaboration";
  import {
    findings,
    hypotheses,
    kindLabel,
    questions,
    threads
  } from "$mock-capabilities/library";
  import { openingFor } from "$mock-capabilities/opening";
  import { activity, project, resources } from "$mock-capabilities/project";
  import { isInspectionKey, viewState, type InspectionKey } from "$model/client/view-state";

  /**
   * The general lens for anything first-class in the project: what it is, who is
   * in it, where it came from, what it touches.
   *
   * `docs/screen-panel-views/inspector/project/resource.md` is the
   * specification. Kind-specific detail belongs to the screen that owns the
   * kind; this one is about identity and relationships. The panel title is the
   * resource's title, so the identity band does not repeat it.
   *
   * **Open and Duplicate sit in the action row rather than in the Actions
   * section.** The specification names them twice — once under Identity and once
   * at the foot — and drawing them twice in a 300px panel is two of the same
   * button a reader has to tell apart. The foot keeps what only belongs there:
   * the destructive one.
   *
   * **Updated by falls back and never guesses.** The record's own actor first,
   * then the latest Activity entry attributable to this resource, then an em
   * dash. Not every kind stores an updating actor, and inventing one is worse
   * than leaving the field empty.
   */
  let { resourceId = "r-memo" }: { resourceId?: string } = $props();

  const view = viewState();

  const all = $derived(resources().current);
  const resource = $derived(all.find((candidate) => candidate.id === resourceId) ?? all[0]);
  const everyThread = $derived(threads().current);

  /**
   * The kinds no screen holds, and the lens that owns each.
   *
   * A connector is read rather than edited, a finding is a conclusion rather
   * than a body, and a Context is a rule — so Open hands these to the inspector
   * instead of minting a tab with nothing to draw in it.
   */
  const OPENS: Record<"file" | "finding" | "connector" | "context", InspectionKey> = {
    file: "project.file",
    finding: "research.accepted-finding",
    connector: "project.connector",
    context: "scope.context"
  };

  /** Presence, scoped to this resource: who has it open right now. */
  const here = $derived(
    members().current.filter((person) => presenceFor(person.id).current.at === resource.name)
  );

  const names = $derived(here.map((person) => person.name).join(", "));

  const updatedBy = $derived(
    resource.updatedBy.length > 0
      ? resource.updatedBy
      : (activity().current.find((entry) => entry.subject === resource.name)?.actor ?? "—")
  );

  const updater = $derived(members().current.find((person) => person.name === updatedBy));

  type Link = {
    readonly id: string;
    readonly title: string;
    readonly relation: string;
    readonly key: InspectionKey;
    readonly kind: string;
  };

  /**
   * A link query in the one direction the model has. Research links exist —
   * a finding knows its thread and its hypothesis, a thread knows its question —
   * so those are real rows. Citation links between ordinary resources do not.
   */
  const links: readonly Link[] = $derived.by(() => {
    const found: Link[] = [];

    const finding = findings().current.find((row) => row.title === resource.name);
    if (finding !== undefined) {
      const from = everyThread.find((row) => row.title === finding.from);
      if (from !== undefined) {
        found.push({
          id: from.id,
          title: from.title,
          relation: "Came out of this thread",
          key: "research.research-thread",
          kind: "thread"
        });
      }
      const bearsOn = hypotheses().current.find((row) => row.title === finding.bearsOn);
      if (bearsOn !== undefined) {
        found.push({
          id: bearsOn.id,
          title: bearsOn.title,
          relation: "Bears on this hypothesis",
          key: "research.hypothesis",
          kind: "hypothesis"
        });
      }
      return found;
    }

    const thread = everyThread.find((row) => row.title === resource.name);
    if (thread !== undefined) {
      const question = questions().current.find((row) => row.title === thread.title);
      if (question !== undefined) {
        found.push({
          id: question.id,
          title: question.title,
          relation: "Linked question",
          key: "research.question",
          kind: "question"
        });
      }
      for (const row of findings().current.filter((candidate) => candidate.from === thread.title)) {
        found.push({
          id: row.id,
          title: row.title,
          relation: "Accepted from this thread",
          key: "research.accepted-finding",
          kind: "finding"
        });
      }
    }

    return found;
  });

  /** Nothing writes a copy yet, so Duplicate lands here and the button says so. */
  let duplicated = $state(false);

  /**
   * Open means the thing itself.
   *
   * Where it opens is [`openingFor`](../../mock-capabilities/opening.ts)'s to
   * answer, because four surfaces ask it. Nothing means no screen holds this
   * kind — a file, a finding, a connector, a Context — and those are things you
   * look at rather than places you go, so they get their lens.
   */
  const open = () => {
    const target = openingFor(resource.kind, resource.id, resource.name);
    if (target) view.open(target);
    else view.inspect(OPENS[resource.kind as keyof typeof OPENS], { kind: "resource", id: resource.id });
  };
</script>

<Panel title={resource.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: project().current.name, key: "project.project" },
        { label: resource.name }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Open" icon={SquareArrowOutUpRight} tone="primary" onclick={open} />
    <PanelButton
      label={duplicated ? "Duplicated" : "Duplicate"}
      icon={Copy}
      disabled={duplicated}
      title={duplicated ? "A copy is already asked for" : "Make a copy in this project"}
      onclick={() => (duplicated = true)}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Kind">{kindLabel(resource.kind)}</PanelField>
    <PanelField label="ID" mono>{resource.id}</PanelField>
  </PanelFields>

  <!--
    Faces and a line of text, because a strip of initials says who only to
    someone who already knows them.
  -->
  <PanelSection title="Editing now" count={here.length} flush>
    {#if here.length === 0}
      <PanelNote>Nobody has this open.</PanelNote>
    {:else}
      <PanelFaces
        actors={here.map((person) => ({ id: person.id, name: person.name }))}
        label="Editing now"
        onselect={(id: string) =>
          view.inspect("collaboration.person", { kind: "person", id })}
      />
      <PanelNote>{names} {here.length === 1 ? "has" : "have"} this open right now.</PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Provenance" open={false} flush>
    <PanelFields>
      <PanelField label="Created by">—</PanelField>
      <PanelField label="Updated by" stacked>
        {#if updater === undefined}
          {updatedBy}
        {:else}
          <PanelLink
            label={updater.name}
            title="{updater.name} — {updater.role}"
            onselect={() =>
              view.inspect("collaboration.person", { kind: "person", id: updater.id })}
          />
        {/if}
      </PanelField>
      <PanelField label="From template">—</PanelField>
      <PanelField label="Updated">{resource.updated}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      No resource stores a creating actor or a template origin, so neither can be said here.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Relationships" count={links.length} open={false} flush>
    {#each links as link (link.id)}
      <PanelRow
        title={link.title}
        sub={link.relation}
        onselect={() => view.inspect(link.key, { kind: link.kind, id: link.id })}
      />
    {/each}
    {#if links.length === 0}
      <PanelNote>No research link names this one.</PanelNote>
    {/if}
    <PanelNote tone="gap">
      Citations between ordinary resources are not modeled, so nothing here can say what cites this.
    </PanelNote>
  </PanelSection>

  <!-- Last and shut, and only the destructive one: the rest are in the action row. -->
  <PanelSection title="Actions" open={false} flush>
    <PanelActions>
      <PanelButton
        label="Delete"
        icon={Trash2}
        tone="danger"
        disabled
        title="Nothing queries what depends on this yet, so deletion cannot be offered safely"
      />
    </PanelActions>
    <PanelNote tone="gap">
      Deleting anything a Context can name is gated on a reverse-dependency query the model does not
      have.
    </PanelNote>
  </PanelSection>
</Panel>
