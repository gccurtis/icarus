<script lang="ts">
  import {
    Panel,
    PanelChoice,
    PanelLink,
    PanelRow,
    PanelSearch,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { AGENTS, PEOPLE } from "$capabilities/cast";
  import { activity, type ActivityEntry } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * Activity — everything an actor did in this project, newest first.
   *
   * `docs/screen-panel-views/context/project/activity.md` is the specification.
   * The record, with no judgment in it: whether something matters is what
   * Mentions is for, and whether something is broken is what Health is for.
   *
   * **The window starts at any time rather than at Today.** The layout puts the
   * earlier days on the screen, and a panel that opened on Today would draw them
   * empty. Picking Today narrows to it.
   *
   * **The digest row is not built.** A day of many events collapsing into one row
   * needs a threshold to collapse at, and the specification leaves that open.
   */
  const view = viewState();

  const events = $derived(activity().current);

  let search = $state("");
  let when = $state("all");
  let actor = $state("all");
  let target = $state("all");

  const WHEN = [
    { value: "all", label: "Any time" },
    { value: "Today", label: "Today" },
    { value: "Yesterday", label: "Yesterday" },
    { value: "Earlier", label: "Earlier" }
  ] as const;

  /** The days the record keeps, in the order they are read. */
  const DAYS: readonly ActivityEntry["day"][] = ["Today", "Yesterday", "Earlier"];

  const choices = (values: readonly string[], any: string) => [
    { value: "all", label: any },
    ...values.map((value) => ({ value, label: value }))
  ];

  const actors = $derived(choices([...new Set(events.map((event) => event.actor))], "Anyone"));

  const targets = $derived(
    choices([...new Set(events.map((event) => event.subject))], "Any target")
  );

  /**
   * The narrowing runs here because the mock door answers unpaged. The real query
   * takes all three as parameters: over a page, a filter applied client-side
   * counts what it can see rather than what there is.
   */
  const shown = $derived(
    events
      .filter((event) => when === "all" || event.day === when)
      .filter((event) => actor === "all" || event.actor === actor)
      .filter((event) => target === "all" || event.subject === target)
      .filter((event) =>
        `${event.actor} ${event.verb} ${event.subject}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
  );

  const onDay = (day: ActivityEntry["day"]) => shown.filter((event) => event.day === day);

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

<Panel title="Activity">
  <!--
    One field over every section, so the scope of the search is the record rather
    than the day it happens to sit above.
  -->
  <PanelSearch
    placeholder="Search activity"
    matched={shown.length}
    total={events.length}
    empty="No activity matches."
    bind:value={search}
    flush
  >
    <PanelChoice
      label="When"
      value={when}
      options={WHEN}
      onchange={(next: string) => (when = next)}
    />

    <!--
      Two listboxes rather than two more rows of chips: an actor list and a target
      list are as long as the project is, and chips at that length wrap into a
      wall above the thing they narrow.
    -->
    <div class="flex flex-col gap-1.5 px-3">
      <PanelSelect
        label="Actor"
        value={actor}
        options={actors}
        onchange={(next: string) => (actor = next)}
      />
      <PanelSelect
        label="Target"
        value={target}
        options={targets}
        onchange={(next: string) => (target = next)}
      />
    </div>

    {#each DAYS as day (day)}
      {#if onDay(day).length > 0}
        <PanelSection title={day} count={onDay(day).length} open={day === "Today"} flush>
          {#each onDay(day) as event (event.id)}
            <!--
              The row is not a button: it holds two. The actor is the way to who
              did it and the target is the way to the event itself, and a button
              inside a button is neither.
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
                      view.inspect("project.activity", {
                        kind: "activity",
                        id: event.id
                      })}
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
