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

  const page = pageOf("inspector");

  const heads = [
    { n: 1, title: "Persona lens", body: "The word Persona, then the name in a text input that saves on Enter, the description in a box that scrolls past three lines, and Open across the row. Then the running tasks and the ones pending review as rows, a rule, and three disclosures shut by default: the definition, the default scope and the default tools. A definition row opens a modal with a tab per section, what the section is for, the text and a Save button. No byline, no revision, no figures, no character counts." },
    { n: 2, title: "Task lens", body: "Open, and Stop or Mark reviewed by state. The state and type as chips, then one line: the persona, which opens its lens, and when it started. The instruction quoted and clamped. The plan carries how long it has run beside its name, then the questions with the open ones toned, and the outputs, scope and tools shut." },
    { n: 3, title: "Automation lens", body: "Open and Run now. The rule as a sentence, the On toggle, the trigger, what fires it, the persona, how often it fired and when last. The tasks it fired as rows, and the tools shut." },
    { n: 4, title: "Tool lens", body: "Reached from a persona, a task or an automation, with crumbs back to it. The tool, whose grant this is, the toggle, whether the persona grants it by default, what granting it means, and how far it reaches." },
    { n: 5, title: "Activity lens", body: "Reached from the library's Activity band. The sentence, the persona that acted, the thing acted on, and when. Open goes to the task, persona or automation it names." }
  ];

  const table = [
    ["agents.persona", "a rail row · the Persona column · a task's persona · an activity entry's persona", "name · description · Open", "updatePersona"],
    ["agents.task", "a task row · a Tasks row · a fired row · a persona lens row", "Open · Stop · Mark reviewed", "updateTask"],
    ["agents.automation", "an Automations row · a persona's rule", "Open · Run now · On", "updateAutomation · runAutomation"],
    ["agents.tool", "a tool row on the persona, task or automation lens or surface", "the toggle", "updatePersona · updateTask · updateAutomation"],
    ["agents.activity", "an Activity entry in the library", "Open", "nothing; it reads"]
  ];

  const keys = [
    ["agents.persona", "keep", "The head lens for a persona: name and description edited in place."],
    ["agents.task", "keep", "The head lens for a task, wherever it is named."],
    ["agents.automation", "keep", "The head lens for a rule."],
    ["agents.tool", "keep", "One tool grant, on whichever thing it came from."],
    ["agents.activity", "add", "One thing an agent did."],
    ["agents.skill", "retire", "Skills are not built."],
    ["agents.behaviour-section", "retire", "A definition section is a disclosure on the persona lens."],
    ["agents.agent-action", "retire", "The action is the automation's persona and instruction."],
    ["agents.last-fired", "retire", "A fire is a task; the task lens reads it."],
    ["agents.model", "retire", "A model preference is not the reader's to set."],
    ["agents.refresh-action", "retire", "No block re-run action in this pass."],
    ["agents.schedule-trigger", "retire", "The automation surface edits the schedule."],
    ["agents.task-behaviour", "retire", "A task's settings are its tools and skills, edited on the surface."],
    ["agents.task-results", "retire", "Outputs are rows on the task lens."],
    ["agents.trigger", "retire", "The automation surface is the chooser."],
    ["agents.what-it-can-look-up", "retire", "Access is a row on the persona lens and a select on the surface."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="lenses"
    kicker="The lenses, live"
    title="Five things, read closely"
    lede="Each at a flank's real width, each already on a subject from the seeded project. The name and description on the persona lens save; the toggles on the tool and automation lenses save."
  >
    <div class="flanks">
      <Noted scope="figure" label="Persona lens">
        <LiveStage label="agents.persona" geometry="320px flank" panes="inspector" inspect="agents.persona" selection={{ kind: "persona", id: "personas:grid-analyst" }} height="40rem" />
      </Noted>
      <Noted scope="figure" label="Task lens">
        <LiveStage label="agents.task" geometry="320px flank" panes="inspector" inspect="agents.task" selection={{ kind: "task", id: "agentTasks:feeder12" }} height="40rem" />
      </Noted>
      <Noted scope="figure" label="Automation lens">
        <LiveStage label="agents.automation" geometry="320px flank" panes="inspector" inspect="agents.automation" selection={{ kind: "automation", id: "automations:nightly" }} height="40rem" />
      </Noted>
      <Noted scope="figure" label="Tool lens">
        <LiveStage label="agents.tool" geometry="320px flank" panes="inspector" inspect="agents.tool" selection={{ kind: "tool", id: "web.search", at: "agentTasks:storm" }} height="30rem" />
      </Noted>
      <Noted scope="figure" label="Activity lens">
        <LiveStage label="agents.activity" geometry="320px flank" panes="inspector" inspect="agents.activity" selection={{ kind: "activity", id: "activity:11" }} height="30rem" />
      </Noted>
    </div>
    <Callouts items={heads} />
  </ReferenceSection>

  <ReferenceSection
    id="reached"
    kicker="Reach"
    title="Where each lens is reached from, and what it may change"
    lede="Every place a persona, task, automation or skill is named opens the same lens. What a lens edits goes through the same procedures the surfaces use, so a value cannot be edited two ways."
  >
    <SpecTable label="Lenses" columns={["Lens", "Reached from", "Controls", "Writes through"]} rows={table} mono={[0, 3]} noted="lens" />
  </ReferenceSection>

  <ReferenceSection
    id="keys"
    kicker="Vocabulary"
    title="Fifteen keys before, five now"
    lede="The retired keys were lenses for parts that are now edited on the surfaces, or for objects this design folds into the task."
  >
    <SpecTable label="Inspector keys" columns={["Key", "Change", "Why"]} rows={keys} mono={[0]} pills={[1]} noted="key" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the lenses raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("inspector")} />
  </ReferenceSection>
</ReferenceShell>

<style>
  .flanks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40rem, 1fr));
    gap: 1.5rem;
    align-items: start;
  }
</style>
