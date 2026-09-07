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

  const page = pageOf("task");

  const callouts = [
    { n: 1, title: "Band and head", body: "A thin band with Back and the word Task. On the surface: an editable title, the type, the state, a count of questions waiting when there are any, when it started, who or what started it, and how long it has run. Open automation appears when a rule fired it. Stop finishes a running task; Mark reviewed finishes one pending review." },
    { n: 2, title: "The instruction", body: "In full on a rule, editable only while no runner has picked the task up, with the persona under it." },
    { n: 3, title: "Plan and questions, side by side", body: "Two panes of the same height under headers cut to the same pattern. The plan is a table: each step with its note, its state in the right column, and the percentage done as that column's header. Questions get the wider half, under a header that says who asked and holds one tab per question. Each is the agent's options plus your own words; the question scrolls and Answer and Reject stay pinned at the foot of the card. A settled question keeps its options with the chosen one marked." },
    { n: 4, title: "Outputs, and what it may reach", body: "One row holding both at the same height. Outputs carry where each landed and show a count only when there are none. Beside them the toggle: the scope, or the tools. Persona defaults hands the scope back." },
    { n: 5, title: "Thread", body: "At the foot and the tallest band on the surface, because reading what the agent said while it works is the point. The turns are cards on the shelf's well, each scrolling under a discreet bar, and the composer sits below the well on the raised surface so it reads as somewhere to type. A finished task says nothing reads its thread any more. Every band has a set height that grows with the window and scrolls inside itself." },
    { n: 6, title: "The form", body: "New task opens this surface on a form: name, instruction, the persona picked from a searchable list, and the tools to start with, already set to the persona's defaults. The scope shows what the persona reads and is narrowed once the task exists. Create and start writes the task and opens it." }
  ];

  const states = [
    ["Running", "The agent has it. Stop finishes it early.", "attention"],
    ["Pending review", "The agent finished and wants a look. Mark reviewed finishes it.", "intelligence"],
    ["Finished", "Done, stopped or reviewed. Nothing changes any more.", "success"]
  ];

  const writes = [
    ["Title", "head", "updateTask · patch.title", "on blur or Enter"],
    ["Instruction", "rule, while no plan", "updateTask · patch.instruction", "on blur; refused once the agent started"],
    ["Stop · Mark reviewed", "head · lens", "updateTask · patch.state", "sets finishedAt and who reviewed"],
    ["A tool", "switch · tool lens", "updateTask · patch.tools", "refused once finished"],
    ["The scope", "add or remove a row", "updateTask · patch.scope", "null gives it back to the persona"],
    ["Answer · Reject", "question tab", "answerTaskQuestion", "once per question; either way the thread hears it"],
    ["Send", "composer", "sendTaskMessage", "appended to the thread; refused once finished"],
    ["Create and start", "form", "createTask", "a running task with its thread opened on the instruction"]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="live"
    kicker="The surface, live"
    title="Feeder 12, mid-run"
    lede="The real task surface on a running task from the seed: a plan under way, outputs already on record, and a thread with three turns. Send something and it lands in the thread."
  >
    <Noted scope="figure" label="Task workbench">
      <LiveStage
        label="agents.task"
        height="56rem"
        content="agents.task"
        focus="agentTasks:feeder12"
        context="agents.tasks"
        inspect="agents.task"
        selection={{ kind: "task", id: "agentTasks:feeder12" }}
      />
    </Noted>
    <Callouts items={callouts} />
  </ReferenceSection>

  <ReferenceSection
    id="waiting"
    kicker="A question waiting"
    title="Substation 14, with the agent asking twice"
    lede="The same surface on a task whose agent stopped to ask. Each question is a tab; an open one carries the attention tone until someone answers or rejects it, and the library counts it against the task."
  >
    <Noted scope="figure" label="Task with a question">
      <LiveStage
        label="agents.task · question open"
        height="48rem"
        content="agents.task"
        focus="agentTasks:substation14"
        context="agents.tasks"
        inspect="agents.task"
        selection={{ kind: "task", id: "agentTasks:substation14" }}
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="states"
    kicker="States"
    title="Three states, and success is not one of them"
    lede="Whether a finished task succeeded is for the agent to say in its outputs. The surface reads what it said."
  >
    <SpecTable label="Task states" columns={["State", "Means", "Tone"]} rows={states} pills={[2]} noted="state" />
  </ReferenceSection>

  <ReferenceSection
    id="writes"
    kicker="What saves"
    title="Eight controls, one procedure each"
    lede="Every write carries the revision the surface read, except the two that only append to the thread."
  >
    <SpecTable label="Writes" columns={["Control", "Where", "Writes through", "When"]} rows={writes} mono={[2]} noted="write" />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the task raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("task")} />
  </ReferenceSection>
</ReferenceShell>
