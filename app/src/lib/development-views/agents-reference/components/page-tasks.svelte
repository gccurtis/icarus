<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Diagram from "$development-views/agents-reference/components/diagram.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import ProcedureChain from "$development-views/agents-reference/components/procedure-chain.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import {
    TASK_CHAINS,
    TASK_CREATE,
    TASK_LIFECYCLE,
    TASK_RUNNER,
    TASK_STATE
  } from "$development-views/agents-reference/procedures/task-spec";

  let { project }: { project: string } = $props();

  const page = pageOf("tasks");

  const fields = [
    ["title · instruction", "string · string", "person", "What it is called and what was asked, verbatim. The instruction is also the thread's first message."],
    ["personaId", "Id<personas>", "person, once", "Chosen at creation and never patchable. It is also what makes the task visible at all."],
    ["origin", "TaskOrigin", "procedure", "person, or automation with the rule's id and the trigger kind. Only person and automation-manual are ever written."],
    ["state", "running · review · finished", "procedure and person", "running at creation. A person may only set finished. Nothing writes review."],
    ["scope", "ResourceSet, optional", "person", "Absent means the surface shows the persona's instead. The server never copies it."],
    ["tools", "ToolId[]", "person, defaulted", "A copy of the persona's grants when the caller sends none. The copy is then the task's own."],
    ["plan", "PlanStep[]", "a runner", "id, title, state of pending, active or done, and an optional note. Always empty."],
    ["outputs", "TaskOutput[]", "a runner", "id, title, optional detail, optional resource ref, and a time. Always empty."],
    ["questions", "TaskQuestion[]", "a runner asks, a person settles", "The runner writes id, text, askedAt, an optional step and options. A person writes answer, answeredAt, answeredBy or rejectedAt."],
    ["createdBy · startedAt", "Actor · number", "procedure", "The viewer and the clock at creation."],
    ["finishedAt · reviewedBy", "number? · Actor?", "person", "Both stamped when somebody finishes it. reviewedBy is whoever pressed the button, never a distinct reviewer."],
    ["revision · updatedAt", "number · number", "procedure", "updateTask bumps the revision. Messaging and answering move only updatedAt."]
  ];

  const derived = [
    ["progress.done", "plan.filter(step is done).length"],
    ["progress.total", "plan.length"],
    ["progress.percent", "null when the plan is empty, else done over total, rounded"],
    ["progress.current", "the first active step's title, else the first pending one, else null"],
    ["openQuestions", "questions with neither an answer nor a rejectedAt"],
    ["outputCount", "outputs.length"],
    ["startedByName", "the creator for a person origin; for an automation, the rule's trigger read as a sentence"],
    ["automationName", "the rule's name, or null when a person made it"]
  ];

  const empty = [
    {
      n: 1,
      title: "Nothing dispatches, and the row says so honestly",
      body: "A task is created running with an empty plan, no outputs and no questions, and it stays that way until a person stops it. Every field a runner would fill already has its shape and its validator; not one of them has a writer."
    },
    {
      n: 2,
      title: "Three states, and only two transitions",
      body: "running to finished, by a person. review is in the union, in the filters, in the persona counts and in three surfaces, and no code writes it. It is the state a runner would move a task into when it wanted a person to look."
    },
    {
      n: 3,
      title: "Every message in every task thread is a prompt",
      body: "createTask writes the instruction, sendTaskMessage writes what a person types, answerTaskQuestion writes the answer. All three are role prompt, authored by the viewer. No response message has ever been written, so the agent and system turn kinds the feed can draw are unreachable."
    },
    {
      n: 4,
      title: "Two guards in updateTask are already dead",
      body: "The instruction guard fires only when a plan exists, and no plan exists. The question procedures can only ever return the refusal that no such question was asked. They are written for the runner and waiting for it."
    },
    {
      n: 5,
      title: "The conversation never reaches a second part",
      body: "threadParts is partitioned by an integer so one row need not grow without bound. openThread always creates part one and appendMessage always appends to the last part. There is no size threshold and nothing creates part two."
    }
  ];

  const runner = [
    ["Claim a task", "Nothing", "A runner needs to take one and say it has, or two runners do the same work."],
    ["Write the plan", "Nothing. planOf exists in the validator and is called by nobody.", "A procedure that replaces the plan array."],
    ["Advance a step", "Nothing", "A procedure that moves one step to active or done, with an optional note."],
    ["Append an output", "Nothing", "A procedure that adds one, with an optional resource ref for what it made."],
    ["Ask a question", "Nothing", "A procedure that appends a TaskQuestion. The answering half already exists and works."],
    ["Answer as the agent", "Nothing", "appendMessage with role response and an agent actor. The projection already reads an absent author as the agent."],
    ["Move to review", "Nothing", "updateTask's validator rejects every state but finished, so this needs its own door."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="state"
    kicker="State"
    title="Eighteen fields, three of them waiting for a writer"
    lede="A task is a run. It starts when it is created, it carries what it was asked and what it may reach, and it holds the three arrays a runner would fill. Read the writer column first: it is the whole story of this page."
  >
    <SpecTable
      label="agentTasks"
      columns={["Field", "Type", "Written by", "What it holds"]}
      rows={fields}
      mono={[0, 1]}
      noted="field"
    />
    <Noted scope="figure" label="The task and its neighbours">
      <Diagram
        label="What a task points at"
        source={TASK_STATE}
        caption="A task names a persona, may name the rule that fired it, and owns exactly one thread."
        minHeight="34rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="lifecycle"
    kicker="State"
    title="Three states, and the one nothing writes"
    lede="The state field is the clearest place to see what is missing. Two of its three values are reachable."
  >
    <Noted scope="figure" label="Task states">
      <Diagram
        label="What moves a task, and what does not"
        source={TASK_LIFECYCLE}
        caption="A person can only finish a task. The validator says so in those words."
        minHeight="24rem"
      />
    </Noted>
    <Callouts items={empty} scope="empty" />
  </ReferenceSection>

  <ReferenceSection
    id="derived"
    kicker="Behaviour"
    title="What is computed rather than stored"
    lede="No row holds a percentage. The plan is the record and the number comes from it, by the same pure function on the server for the list and on the client for the surface."
  >
    <SpecTable
      label="Derived on every read"
      columns={["What a surface reads", "How it is derived"]}
      rows={derived}
      mono={[0]}
      noted="derived"
    />
  </ReferenceSection>

  <ReferenceSection
    id="chains"
    kicker="Procedures"
    title="Five procedures, step by step"
    lede="What each takes, every step in order, what it writes, what it refuses and what it refreshes. Note which ones move the revision: editing does, talking does not."
  >
    <div class="ar-chains">
      {#each TASK_CHAINS as chain (chain.name)}
        <ProcedureChain {chain} />
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="create"
    kicker="Execution"
    title="Making a task, and then nothing"
    lede="Three rows are written and the request returns. Read the last line of the diagram as the point of this page."
  >
    <Noted scope="figure" label="Creating a task">
      <Diagram
        label="createTask, end to end"
        source={TASK_CREATE}
        caption="The instruction becomes the thread's first message so that the conversation and the field never disagree about what was asked."
        minHeight="36rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="runner"
    kicker="Execution"
    title="What a runner would have to be given"
    lede="Not one of these exists. The existing doors cannot serve: updateTask's allowed patch keys exclude the three arrays, and its validator refuses any state but finished."
  >
    <Noted scope="figure" label="The runner">
      <Diagram
        label="The shape of the missing half"
        source={TASK_RUNNER}
        caption="The answering half of the question loop is already built and works. Everything that would ask a question is not."
        minHeight="36rem"
      />
    </Noted>
    <SpecTable
      label="What is missing"
      columns={["A runner needs to", "What exists today", "What it would take"]}
      rows={runner}
      noted="missing"
    />
  </ReferenceSection>
</ReferenceShell>
