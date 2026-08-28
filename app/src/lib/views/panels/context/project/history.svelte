<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelLink,
    PanelRow,
    PanelSearch,
    PanelSection,
    PanelToggle
  } from "$authored-components/panel";
  import { AGENTS, PEOPLE, actorName } from "$capabilities/cast";
  import { mentionsForViewer, type PersonComment } from "$capabilities/collaboration";
  import { activity, type ActivityEntry } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * History — what has happened here, with what was addressed to you first.
   *
   * One panel for two things, because they answer one question asked in one
   * breath: *what have I missed*. A mention is an event with your name in it, so
   * splitting them across two panels means checking two places to find out
   * whether anything needs you, and finding the same edit described twice.
   *
   * **Addressed to you is a band, not a filter.** It is above the record rather
   * than a chip over it, because the whole reason it is separate is that it does
   * not compete with the record for attention — it wins.
   *
   * **Resolved is excluded by default.** A resolved comment is a thing that
   * happened, so it stays in the record; it is not a thing that needs you, so it
   * leaves this band unless asked for.
   */
  const events = $derived(activity().current);
  const mentions = $derived(mentionsForViewer().current);

  let search = $state("");
  let when = $state("all");
  let showResolved = $state(false);

  const WHEN = [
    { value: "all", label: "Any time" },
    { value: "Today", label: "Today" },
    { value: "Yesterday", label: "Yesterday" },
    { value: "Earlier", label: "Earlier" }
  ] as const;

  const DAYS: readonly ActivityEntry["day"][] = ["Today", "Yesterday", "Earlier"];

  const needle = $derived(search.trim().toLowerCase());

  const shownMentions = $derived(
    mentions
      .filter((comment: PersonComment) => showResolved || !comment.resolved)
      .filter((comment: PersonComment) =>
        `${comment.resource} ${comment.excerpt}`.toLowerCase().includes(needle)
      )
  );

  const shownEvents = $derived(
    events
      .filter((event: ActivityEntry) => when === "all" || event.day === when)
      .filter((event: ActivityEntry) =>
        `${event.actor} ${event.verb} ${event.subject}`.toLowerCase().includes(needle)
      )
  );

  const onDay = (day: ActivityEntry["day"]) =>
    shownEvents.filter((event: ActivityEntry) => event.day === day);

  /** An event records its actor as a display name, so the lens follows the name. */
  const openActor = (name: string) => {
    const person = PEOPLE.find((candidate) => candidate.name === name);
    if (person) {
      view.inspect("collaboration.person", { kind: "person", id: person.id });
      return;
    }

    const agent = AGENTS.find((candidate) => candidate.name === name);
    if (agent) {
      view.inspect("agents.persona", { kind: "agent", id: agent.id });
      return;
    }

    view.inspect("project.connector", { kind: "connector", id: name });
  };
</script>

<Panel title="History">
  <PanelSearch
    placeholder="Search history"
    matched={shownMentions.length + shownEvents.length}
    total={mentions.length + events.length}
    empty="Nothing here matches."
    bind:value={search}
    flush
  >
    <PanelSection title="Addressed to you" count={shownMentions.length} open flush>
      <div class="px-3 pb-1">
        <PanelToggle
          label="Include resolved"
          checked={showResolved}
          onchange={(next: boolean) => (showResolved = next)}
        />
      </div>

      {#each shownMentions as comment (comment.id)}
        <PanelRow
          title="{actorName(comment.author)} on {comment.resource}"
          sub={comment.excerpt}
          meta={comment.resolved ? `resolved · ${comment.age}` : comment.age}
          onselect={() =>
            view.inspect("collaboration.comment", { kind: "comment", id: comment.id })}
        />
      {/each}
    </PanelSection>

    <PanelChoice
      label="When"
      value={when}
      options={WHEN}
      onchange={(next: string) => (when = next)}
    />

    {#each DAYS as day (day)}
      {#if onDay(day).length > 0}
        <PanelSection title={day} count={onDay(day).length} open={day === "Today"} flush>
          {#each onDay(day) as event (event.id)}
            <!--
              The row is not a button: it holds two. The actor is the way to who
              did it and the target is the way to the event itself.
            -->
            <PanelRow title="{event.actor} {event.verb} {event.subject}" meta={event.at}>
              {#snippet children()}
                <span class="text-body-sm text-ink-primary">
                  <PanelLink
                    label={event.actor}
                    title="Open {event.actor}"
                    onselect={() => openActor(event.actor)}
                  />
                  {event.verb}
                  <PanelLink
                    label={event.subject}
                    title="Open this event"
                    onselect={() =>
                      view.inspect("project.activity", { kind: "activity", id: event.id })}
                  />
                </span>
              {/snippet}
            </PanelRow>
          {/each}
        </PanelSection>
      {/if}
    {/each}
  </PanelSearch>
</Panel>
