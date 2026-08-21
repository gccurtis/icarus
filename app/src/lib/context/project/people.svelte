<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelNote,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import { AGENTS, VIEWER } from "$mock-capabilities/cast";
  import { health, people, tasks } from "$mock-capabilities/project";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * People — everything that can appear as "who did this".
   *
   * `docs/screen-panel-views/context/project/people.md` is the specification.
   * Personas, Automations and connectors share a section because they share the
   * property the section is about: they can act with no person present.
   *
   * **Health is the only door that names an Automation or a connector today**, so
   * the machinery listed here is the machinery that has a problem. The note at
   * the foot says the other thing the section cannot show: that only a person can
   * be written to.
   */
  const everyone = $derived(people().current);
  const work = $derived(tasks().current);
  const problems = $derived(health().current);

  let search = $state("");

  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());

  /** Personas carry their work count, because it is what says one is in use. */
  const tally = (agent: string) => work.filter((task) => task.agent === agent).length;

  const machinery = $derived([
    ...AGENTS.map((agent) => ({
      id: agent.id,
      name: agent.name,
      kind: "agent" as const,
      role: tally(agent.name) === 0 ? "Persona" : `Persona · ${tally(agent.name)} tasks`,
      lens: "agents.persona",
      selected: "agent"
    })),
    ...problems
      .filter((issue) => issue.group === "Automations")
      .map((issue) => ({
        id: issue.id,
        name: issue.title,
        kind: "automation" as const,
        role: "Automation",
        lens: "agents.automation",
        selected: "automation"
      })),
    ...problems
      .filter((issue) => issue.group === "Connectors")
      .map((issue) => ({
        id: issue.id,
        name: issue.title,
        kind: "connector" as const,
        role: "Connector",
        lens: "project.connector",
        selected: "connector"
      }))
  ]);

  const shownPeople = $derived(everyone.filter((person) => matches(person.name)));
  const shownMachines = $derived(machinery.filter((machine) => matches(machine.name)));

  /** Here now is a subset of Everyone, so it is not counted a second time. */
  const total = $derived(everyone.length + machinery.length);
  const matched = $derived(shownPeople.length + shownMachines.length);

  const hereNow = $derived(shownPeople.filter((person) => person.at !== undefined));

  /** Where somebody is, and whether the somebody is you. */
  const standing = (at: string, id: string) => (id === VIEWER.id ? `${at} · you` : at);
</script>

<Panel title="People">
  <!--
    One field over all three sections: an actor is looked for by name, and which
    of the three they turn out to be is the answer rather than the question.
  -->
  <PanelSearch
    placeholder="Search people and machinery"
    {matched}
    {total}
    empty="Nobody here by that name."
    bind:value={search}
  >
    <PanelSection title="Here now" count={hereNow.length}>
      {#each hereNow as person (person.id)}
        <PanelActor
          name={person.name}
          kind="person"
          role={standing(person.at ?? "", person.id)}
          onselect={() => mockWorkbench.inspect("actor.person", { kind: "person", id: person.id })}
        />
      {/each}

      {#if hereNow.length === 0}
        <PanelNote>Nobody is in the project right now.</PanelNote>
      {/if}
    </PanelSection>

    <PanelSection title="Everyone" count={shownPeople.length}>
      {#each shownPeople as person (person.id)}
        <PanelActor
          name={person.name}
          kind="person"
          role={person.role}
          onselect={() => mockWorkbench.inspect("actor.person", { kind: "person", id: person.id })}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Agents and machinery" count={shownMachines.length}>
      {#each shownMachines as machine (machine.id)}
        <PanelActor
          name={machine.name}
          kind={machine.kind}
          role={machine.role}
          onselect={() =>
            mockWorkbench.inspect(machine.lens, { kind: machine.selected, id: machine.id })}
        />
      {/each}
    </PanelSection>

    <PanelNote>
      Only a person can be written to. The rest act here, but there is nowhere to address them.
    </PanelNote>
  </PanelSearch>
</Panel>
