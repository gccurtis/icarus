<script lang="ts">
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";

  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { AGENTS, PEOPLE } from "$capabilities/cast";
  import { resourceNamed } from "$capabilities/collaboration";
  import { connectors } from "$capabilities/library";
  import { activity, project } from "$capabilities/project";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One recorded event: who, what, to what, when.
   *
   * `docs/screen-panel-views/inspector/project/activity.md` is the
   * specification. The smallest lens on the screen — an event is a fact, so the
   * work here is restating it precisely and offering the way to its target.
   *
   * **The actor's kind is named beside the actor**, because "edited by Nightly
   * filing digest" and "edited by Ana Reyes" are different claims and the face
   * alone does not tell them apart.
   *
   * **A target that no longer exists gets a sentence, not a dead button.** The
   * feed stores the subject by name, so whether it is still there is a lookup
   * and the answer decides which of the two this section draws.
   */
  let { eventId }: { eventId?: string } = $props();

  const view = viewState();

  const id = $derived(eventId ?? view.selection?.id ?? "ev-1");

  const events = $derived(activity().current);
  const entry = $derived(events.find((candidate) => candidate.id === id) ?? events[0]);

  /** The feed names its actor. Which of the three kinds it is comes from the cast. */
  const person = $derived(PEOPLE.find((candidate) => candidate.name === entry.actor));
  const agent = $derived(AGENTS.find((candidate) => candidate.name === entry.actor));
  const source = $derived(connectors().current.find((row) => row.name === entry.actor));

  const kind = $derived(person !== undefined ? "person" : agent !== undefined ? "agent" : "connector");
  const KIND_WORD = { person: "user", agent: "agent", connector: "connector" } as const;

  const openActor = () => {
    if (person !== undefined) {
      view.inspect("collaboration.person", { kind: "person", id: person.id });
      return;
    }
    if (agent !== undefined) {
      view.inspect("agents.persona", { kind: "agent", id: agent.id });
      return;
    }
    if (source !== undefined) {
      view.inspect("project.connector", { kind: "connector", id: source.id });
    }
  };

  const known = $derived(person !== undefined || agent !== undefined || source !== undefined);

  /** What the event was about, resolved against the project as it is now. */
  const target = $derived(resourceNamed(entry.subject));

  const openTarget = () => {
    if (target === undefined) return;
    view.inspect("project.resource", { kind: "resource", id: target.id });
  };

  /** The feed groups by day, so a lens on one event carries the day itself. */
  const when = $derived(`${entry.day} · ${entry.at}`);
</script>

<Panel title="{entry.actor} {entry.verb} {entry.subject}">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: project().current.name, key: "project.project" },
        { label: "Activity" }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelActor
    name={entry.actor}
    {kind}
    role={KIND_WORD[kind]}
    size="head"
    onselect={known ? openActor : undefined}
  />

  <PanelFields>
    <PanelField label="Action">{entry.verb}</PanelField>
    <PanelField label="Target" stacked>
      {#if target === undefined}
        {entry.subject}
      {:else}
        <PanelLink
          label={entry.subject}
          title="Open {entry.subject}"
          onselect={openTarget}
        />
      {/if}
    </PanelField>
    <PanelField label="When">{when}</PanelField>
  </PanelFields>

  <!--
    The machine-readable form, shut: it is here for someone chasing a record,
    not for the reader who clicked a row in the feed.
  -->
  <PanelSection title="Details" open={false} flush>
    <PanelFields>
      <PanelField label="Event" mono>—</PanelField>
      <PanelField label="Source ID" mono>{entry.id}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      No machine-readable event kind is stored. The action above is the whole record.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Navigation" flush>
    {#if target === undefined}
      <PanelNote>
        {entry.subject} is no longer in the project, so there is nowhere to open.
      </PanelNote>
    {:else}
      <PanelActions>
        <PanelButton
          label="Open target"
          icon={SquareArrowOutUpRight}
          tone="primary"
          onclick={openTarget}
        />
      </PanelActions>
    {/if}
  </PanelSection>
</Panel>
