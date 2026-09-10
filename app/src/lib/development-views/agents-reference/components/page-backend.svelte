<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import FilePlan from "$development-views/agents-reference/components/file-plan.svelte";
  import Flow from "$development-views/agents-reference/components/flow.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";

  let { project }: { project: string } = $props();

  const page = pageOf("backend");

  const tables = [
    ["personas", "modify", "name · description · definition · scope · cast · tools · avatar · createdBy · revision · updatedAt", "tools becomes the closed ToolId union"],
    ["agentTasks", "modify", "threadId · title · instruction · personaId · origin · state · scope · tools · plan · outputs · questions · createdBy · startedAt · finishedAt · reviewedBy · revision · updatedAt", "a task is a run; status, prompt, data and error go; scope joins"],
    ["automations", "create", "name · personaId · instruction · trigger · scope · tools · enabled · firedCount · lastFiredAt · createdBy · revision · updatedAt", "a rule that makes tasks"],
    ["researchThreads", "keep", "threadId · personaId · title · mode · findingIds · createdBy · updatedAt", "a chat, owned and projected by the research and agents capabilities"],
    ["threads", "keep", "kind · branchedFrom", "one per task and per chat"],
    ["threadParts", "keep", "threadId · part · messages", "the turns"]
  ];

  const procedures = [
    ["readAgentsLibrary", "query", "everything the category lists, in one answer", "—"],
    ["readPersona · readTask · readAutomation", "query", "one thing in full, or null", "—"],
    ["createPersona", "command", "a row at revision one under the given name", "—"],
    ["createTask", "command", "a running task with its thread opened on the instruction", "not-found"],
    ["createAutomation", "command", "a rule; switched off when it has no instruction", "not-found"],
    ["createChat", "command", "a persona thread in its own thread row", "not-found"],
    ["updatePersona · updateTask · updateAutomation", "command", "a compare-and-swap patch", "not-found · stale · invalid-state"],
    ["duplicatePersona", "command", "a viewer-owned copy at revision one", "not-found"],
    ["removePersona · removeAutomation", "command", "removal", "not-found · stale · in-use"],
    ["runAutomation", "command", "one task from the saved rule, and the fire counted", "not-found · invalid-state"],
    ["sendTaskMessage", "command", "a person's message appended to the thread", "not-found · invalid-state"],
    ["answerTaskQuestion", "command", "an answer on one open question, also appended", "not-found · invalid-state"]
  ];

  const write = [
    { actor: "Surface", action: "Sends the patch with the revision it read.", artifact: "updatePersona({ personaId, baseRevision, patch })" },
    { actor: "Door", action: "Establishes the scope, validates the input, finds the visible row.", artifact: "requireScope() · validateUpdatePersona()" },
    { actor: "Door", action: "Refuses if the revision moved or the scope includes nothing.", artifact: "{ accepted: false, reason: \"stale\" }" },
    { actor: "Store", action: "Replaces the row at revision + 1.", artifact: "store.update(\"personas.<id>\", fields)" },
    { actor: "Index", action: "Refreshes the library and the detail query the surface holds.", artifact: "readAgentsLibrary().refresh() · readPersona({ personaId }).refresh()" }
  ];

  const seed = [
    ["personas.json", "4", "Grid Analyst, Filing Editor, Source Checker, Skeptic; all in the project"],
    ["agentTasks.json", "17", "3 running, 3 pending review, 11 finished; one with two open questions and three with their own scope"],
    ["automations.json", "8", "3 manual, 2 scheduled, 2 on edit, 1 on create; the board pack is off"],
    ["researchThreads.json", "5", "chats across all four personas"],
    ["threads.json", "22", "one per task and per chat"],
    ["threadParts.json", "22", "every thread's messages, the instruction first"]
  ];

  const invariants = [
    { n: 1, title: "Every procedure opens with the scope", body: "requireScope first, validation second, the store third. The lint proves the order." },
    { n: 2, title: "Refusals are answers", body: "not-found, stale, in-use and invalid-state come back as accepted: false with the row's current revision, never as a thrown error." },
    { n: 3, title: "A task's revision guards edits, not activity", body: "Appending a message and firing a rule change nothing a person edits, so they bump updatedAt and leave the revision alone." },
    { n: 4, title: "Progress is derived", body: "No row stores a percentage. The plan is the record and the number comes from it, on the server for the list and on the client for the surface, from the same behavior function." },
    { n: 5, title: "Nothing dispatches", body: "A created task has an empty plan and says so. A runner would write plan, outputs and questions into exactly these fields." }
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="tables"
    kicker="Representation"
    title="Six tables, one new"
    lede="A task is a run, so there is no runs table. Automations are new. Threads and their parts are the existing conversation primitive, reused for both tasks and chats."
  >
    <SpecTable label="Tables" columns={["Table", "Change", "Fields", "Note"]} rows={tables} mono={[0, 2]} pills={[1]} noted="table" />
  </ReferenceSection>

  <ReferenceSection
    id="procedures"
    kicker="The capability"
    title="Seventeen procedures behind one index"
    lede="Five reads and sixteen writes. Every command refreshes the library query and the detail query it changed from inside the same request."
  >
    <SpecTable label="Procedures" columns={["Procedure", "Kind", "Answers", "Refuses"]} rows={procedures} mono={[0]} noted="procedure" />
  </ReferenceSection>

  <ReferenceSection
    id="write"
    kicker="One write, end to end"
    title="How a section edit reaches the store"
    lede="The same five steps for every compare-and-swap write in the capability."
  >
    <Noted scope="figure" label="Write flow">
      <Flow label="A write" steps={write} tone="intelligence" />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="seed"
    kicker="Seed"
    title="The Grid Resilience cast, as rows"
    lede="Seven files under app/seed, copied into data/ by pnpm seed. Every page of this suite reads them."
  >
    <SpecTable label="Seed files" columns={["File", "Rows", "Holds"]} rows={seed} mono={[0]} noted="seed" />
  </ReferenceSection>

  <ReferenceSection
    id="invariants"
    kicker="Invariants"
    title="Five things the tests hold to"
    lede="The capability's unit tests and the structural lint between them keep these."
  >
    <Callouts items={invariants} scope="invariant" />
  </ReferenceSection>

  <ReferenceSection
    id="files"
    kicker="The file plan"
    title="Every file, by phase"
    lede="What was created, modified and deleted, under the phase that made it. The last phase is what remains."
  >
    <FilePlan />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions the backend raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("backend")} />
  </ReferenceSection>
</ReferenceShell>
