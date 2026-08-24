<script lang="ts">
  import AtSign from "@lucide/svelte/icons/at-sign";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import {
    Panel,
    PanelChip,
    PanelEditableText,
    PanelFaces,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { VIEWER } from "$mock-capabilities/cast";
  import { member, mentionsForViewer } from "$mock-capabilities/collaboration";
  import { activity, health, people, project, resources } from "$mock-capabilities/project";
  import { viewState, type InspectionKey } from "$model/client/view-state";

  const view = viewState();

  /**
   * The project itself — what it is, what state it is in, who is here, and what
   * is waiting on you.
   *
   * `docs/screen-panel-views/context/overview/project.md` is the specification.
   * The first rail entry and the default, so it answers "where am I and what is
   * outstanding" without a click.
   *
   * **The identity band is not a section.** A collapsible over the project's own
   * name would let a reader hide the one thing that says which project this is.
   * Everything that qualifies it below is disclosable; the name is not.
   *
   * **Project work counts the same query the centre table lists**, rather than a
   * stored total, so the number beside *Project work* and the rows in the work
   * table can never disagree.
   */
  const it = $derived(project().current);
  const viewer = $derived(member(VIEWER.id).current);
  const everyone = $derived(people().current);
  const work = $derived(resources().current);
  const mentions = $derived(mentionsForViewer().current);
  const problems = $derived(health().current);
  const events = $derived(activity().current);

  /** Edits are held here until there is a door to write them through. */
  let nameDraft = $state("");
  let aboutDraft = $state("");

  /** Presence, not last-seen: only someone with somewhere to be is here now. */
  const here = $derived(
    everyone
      .filter((person) => person.at !== undefined)
      .map((person) => ({ id: person.id, name: person.name }))
  );

  const unread = $derived(mentions.filter((comment) => !comment.resolved).length);

  /** A broken thing opens as what it is, rather than as a generic health row. */
  const lensFor = (group: (typeof problems)[number]["group"]): InspectionKey =>
    group === "Connectors"
      ? "project.connector"
      : group === "Extraction"
        ? "project.file"
        : "agents.automation";
</script>

<!--
  No Settings control here or on the screen. It belongs in the top bar, which is
  not built — and a button with nowhere to go is worse than no button, because it
  is the one thing on the panel that teaches you not to trust the others.
-->
<Panel title="Overview">
  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText
        value={nameDraft || it.name}
        label="Project name"
        onchange={(next: string) => (nameDraft = next)}
      />
    </PanelField>
    <PanelField label="About" stacked>
      <PanelEditableText
        value={aboutDraft || it.description}
        label="What this project is"
        placeholder="Say what this project is for"
        multiline
        onchange={(next: string) => (aboutDraft = next)}
      />
    </PanelField>
  </PanelFields>

  <PanelSection title="State">
    <PanelFields>
      <PanelField label="Status">
        <PanelChip tone={it.archived ? "inactive" : "success"}>
          {it.archived ? "Archived" : "Active"}
        </PanelChip>
      </PanelField>
      <PanelField label="Your role">{viewer.role}</PanelField>
      <PanelField label="Members" mono>{it.counts.people}</PanelField>
      <PanelField label="Project work" mono>{work.length} items</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Here now" count={here.length}>
    <PanelFaces
      actors={here}
      label="In the project now"
      onselect={(id: string) =>
        view.inspect("collaboration.person", { kind: "person", id })}
      onoverflow={() => view.inspect("collaboration.people")}
    />
    {#if here.length === 0}
      <PanelNote>Nobody else is in the project right now.</PanelNote>
    {/if}
  </PanelSection>

  <!--
    Two kinds of interruption and no third: someone addressed you, or something
    is broken. Everything else the project is doing belongs in Activity.
  -->
  <PanelSection title="Needs you" count={(unread > 0 ? 1 : 0) + problems.length} flush>
    {#if unread > 0}
      <PanelRow
        title="{unread} mentions"
        sub="Unread"
        icon={AtSign}
        tone="attention"
        onselect={() => view.selectContext("project.mentions")}
      />
    {/if}

    {#each problems as problem (problem.id)}
      <PanelRow
        title={problem.title}
        sub={problem.detail}
        icon={TriangleAlert}
        tone={problem.tone}
        onselect={() =>
          view.inspect(lensFor(problem.group), { kind: "health", id: problem.id })}
      />
    {/each}

    <PanelNote tone="gap">
      Nothing records which mentions you have read, so every mention addressed to
      you is counted as unread.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Dates" open={false}>
    <PanelFields>
      <PanelField label="Created" mono>{it.createdAt}</PanelField>
      <!-- The project stores no updated stamp; the newest recorded event is it. -->
      <PanelField label="Updated" mono>{events[0]?.at ?? "Never"}</PanelField>
    </PanelFields>
    <PanelNote>The project records no creator or updater, so these are dates only.</PanelNote>
  </PanelSection>
</Panel>
