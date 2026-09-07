<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import LiveStage from "$development-views/agents-reference/components/live-stage.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("context");

  const callouts = [
    { n: 1, title: "Personas · the landing panel", body: "The name and the record: n tasks, then running and to review only when they are not zero. A click opens the lens; a double-click opens the persona. New creates one under a working name and opens it." },
    { n: 2, title: "Tasks · three groups", body: "Running, Pending review and Finished, searchable across the title and the persona. A title takes the attention tone while the agent has a question waiting. Finished starts shut unless nothing else is there." },
    { n: 3, title: "Automations · manual, on and off", body: "Every rule in three sections. Manual holds the ones a person fires by hand, each with a Run control that makes one task and inspects it. On and Off hold the standing rules, with the persona and the trigger under the name and the last fire at the end. Off starts shut unless nothing is on." }
  ];

  const routing = [
    ["Persona row", "Inspects", "Opens the persona surface", "personas"],
    ["Task row", "Inspects the task", "Opens the task surface", "tasks"],
    ["Automation row", "Inspects the automation", "Opens the automation surface", "automations"],
    ["Run control", "Makes one task and inspects it", "—", "automations"],
    ["New, anywhere", "Creates under a working name and opens; a task opens its form instead", "—", "all"]
  ];

  const keys = [
    ["agents.personas", "keep", "The roster.", "The landing entry; inspects."],
    ["agents.tasks", "keep", "Running, pending review, finished.", "Was every task by state; the states changed."],
    ["agents.automations", "keep", "Every rule.", "Manual, On and Off in one panel."],
    ["agents.chats", "retire", "Every chat with a persona.", "A chat is started from a persona and lives in its own tab."],
    ["agents.manual", "retire", "Manual automations, each runnable.", "A section of Automations."],
    ["agents.skills", "retire", "Every skill.", "Skills are not built."],
    ["agents.overview", "retire", "Running, failed and personas as figures.", "The Tasks panel's groups answer it."],
    ["agents.behaviour", "retire", "The five sections as rows.", "Disclosures on the persona surface and lens."],
    ["agents.context-persona", "retire", "The persona's scope.", "The persona's default scope."],
    ["agents.work", "retire", "A persona's tasks by state.", "The persona surface's own band."],
    ["agents.tools", "retire", "Allowed and not allowed.", "Grants on the persona surface."],
    ["agents.when", "retire", "The trigger chooser.", "The automation surface."],
    ["agents.do-this", "retire", "The action chooser.", "The automation surface."],
    ["agents.health", "retire", "Triggered tasks by fate.", "Not for now."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="panels"
    kicker="The panels, live"
    title="Three panels, each at a flank's real width"
    lede="These are the built panels over the seeded project, each in its own workspace state so choosing in one does not move another. The rail beside each shows where it sits."
  >
    <div class="flanks">
      <Noted scope="figure" label="Personas panel">
        <LiveStage label="agents.personas" geometry="rail + 248px flank" panes="context" context="agents.personas" height="34rem" />
      </Noted>
      <Noted scope="figure" label="Tasks panel">
        <LiveStage label="agents.tasks" geometry="rail + 248px flank" panes="context" context="agents.tasks" height="34rem" />
      </Noted>
      <Noted scope="figure" label="Automations panel">
        <LiveStage label="agents.automations" geometry="rail + 248px flank" panes="context" context="agents.automations" height="34rem" />
      </Noted>
    </div>
    <Callouts items={callouts} />
  </ReferenceSection>

  <ReferenceSection
    id="routing"
    kicker="Routing"
    title="What a row does, and where it goes"
    lede="Panels list, group and route, and none of them carries a note saying so. No panel narrows the centre; the library's filters are its own. The one control that is not routing is Run, because firing a rule is what a manual rule is for."
  >
    <SpecTable label="Routing" columns={["Row", "Click", "Double-click", "Panel"]} rows={routing} noted="route" />
  </ReferenceSection>

  <ReferenceSection
    id="keys"
    kicker="Vocabulary"
    title="Fourteen keys before, three now"
    lede="Most of the old keys had no file and never would under this design. Chats, manual work and skills each turned out to belong somewhere else, or nowhere yet."
  >
    <SpecTable label="Context keys" columns={["Key", "Change", "Was for", "Now"]} rows={keys} mono={[0]} pills={[1]} noted="key" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the rail raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("context")} />
  </ReferenceSection>
</ReferenceShell>

<style>
  .flanks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40rem, 1fr));
    gap: 1.5rem;
  }
</style>
