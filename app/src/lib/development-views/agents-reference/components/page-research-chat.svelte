<script lang="ts">
  import Callouts from "$development-views/agents-reference/components/callouts.svelte";
  import Diagram from "$development-views/agents-reference/components/diagram.svelte";
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import ProcedureChain from "$development-views/agents-reference/components/procedure-chain.svelte";
  import Questions from "$development-views/agents-reference/components/questions.svelte";
  import ReferenceSection from "$development-views/agents-reference/components/reference-section.svelte";
  import ReferenceShell from "$development-views/agents-reference/components/reference-shell.svelte";
  import SpecTable from "$development-views/agents-reference/components/spec-table.svelte";
  import { pageOf } from "$development-views/agents-reference/procedures/navigation";
  import { questionsFor } from "$development-views/agents-reference/procedures/questions";
  import { RESEARCH_CHAINS } from "$development-views/agents-reference/procedures/research-chat-chains";
  import {
    STATE_DIAGRAM,
    RECOVERY_DIAGRAM,
    STEER_DIAGRAM,
    SYSTEM_DIAGRAM,
    TOOL_DIAGRAM,
    TURN_DIAGRAM,
    TURN_STATE_DIAGRAM
  } from "$development-views/agents-reference/procedures/research-chat-diagrams";

  let { project }: { project: string } = $props();

  const page = pageOf("research-chat");

  const separate = [
    {
      n: 1,
      title: "It shares no table with the agents system",
      body: "Agents owns personas, agentTasks and automations. Research chat owns researchThreads and researchTurns. The only thing both touch is threads and threadParts, which is the conversation primitive rather than either system's own state, and each opens its own with a different ThreadKind."
    },
    {
      n: 2,
      title: "One thing crosses: starting a chat from a persona",
      body: "Nothing in capabilities/research-chat imports capabilities/agents, and nothing in agents imports research-chat. But the agents createChat writes a researchThreads row, because a persona chat is a research chat. That is the coupling, and it is a row rather than a call."
    },
    {
      n: 3,
      title: "A persona is where the two meet",
      body: "A chat may carry a personaId. Its five definition sections are appended to the standing rules, and its grants decide which tool families are built: retrieve opens both search lanes, resource.read opens reading and listing. A chat with no persona gets the two default grants. A persona that may do neither is refused before anything runs, because it would have nothing to answer from."
    },
    {
      n: 4,
      title: "A task is a run; a turn is an exchange",
      body: "A task has a plan, outputs, questions it asks a person, and a state that outlives the request that made it. A turn is one question and one answer, made and finished inside a single request. Building either on the other would make one of them lie about its lifetime."
    }
  ];

  const capabilities = [
    ["capabilities/research-chat", "index.remote.ts", "Seven procedures, the tools, the loop, the flight registry and the projection. Owns researchThreads and researchTurns.", "Owns"],
    ["capabilities/semantic-overlay", "index.ts", "querySemanticOverlay, querySemanticMaterials, readSemanticResourceForModel, enqueueSemanticSync, processSemanticSyncQueueFor, semanticSourceIsCurrent.", "Reads through its index"],
    ["model/server/intelligence", "index.server.ts", "completeWithTools and the OpenRouter provision. The agent loop runs inside it.", "Server model object"],
    ["model/server/embedding", "index.server.ts", "The vectors. Reached only through the overlay, never directly.", "Indirect"],
    ["model/server/store", "index.server.ts", "read, create, update, removeRows.", "Server model object"],
    ["runtime/server", "scope.server · start.server", "requireScope for who is asking, serverModel for the one graph.", "The two entries a procedure may use"],
    ["capabilities/store", "index.remote.ts", "read, refreshed after a write so a tab's title follows the chat.", "Refreshes"],
    ["capabilities/agents", "—", "Nothing is imported either way. It reads the personas table directly, gated by project, and agents writes a researchThreads row when a chat is started from a persona.", "Shares two tables"]
  ];

  const tables = [
    ["threads", "projectId · kind · branchedFrom?", "The conversation primitive. A chat opens one with kind researchThread; a task opens one with kind agentTask.", "Shared with tasks"],
    ["threadParts", "projectId · threadId · part · messages", "The messages, in numbered parts so one row never grows without bound. A chat appends to the last part.", "Shared"],
    ["researchThreads", "projectId · threadId · title · mode · personaId? · findingIds · createdBy · updatedAt", "The chat. Its title is written from the first question when it is still New chat, and its personaId is who it answers as. A chat started from a persona is one of these.", "Owned"],
    ["researchTurns", "the question, the answer's blocks, the searches, the sources, the findings, the model, the cost, the state", "One row per exchange, keyed to the two messages it sits between.", "Owned"]
  ];

  const turnFields = [
    ["promptMessageId · messageId", "string · string?", "The two messages this turn explains. messageId is absent while it runs and on failure."],
    ["prompt", "string", "The question, copied so a turn reads without walking the thread."],
    ["mode · scope · tools", "ResearchMode · ResearchScope · ResearchToolId[]", "What was asked for. The scope is the whole project or one resource, chosen in the composer, and every tool is gated on it. Recorded per turn because the answer is only reproducible with them."],
    ["model", "string", "Which model was named for this call, so an answer can be read against what produced it."],
    ["state", "running · answered · insufficient · failed · cancelled", "queued exists in the type and nothing writes it. cancelled is written when a person pressed Stop twice."],
    ["stopRequestedAt", "number, optional", "When somebody asked it to answer now. On the row so a reload still shows the control as Cancel."],
    ["blocks", "ContentBlock[]", "The answer. Text blocks today; the union already carries table and image."],
    ["queries", "string[]", "Every distinct search the model ran. The cheapest explanation of a thin answer."],
    ["sources", "ResearchSource[]", "id, ref, title, locator, excerpt, and what the answer took from it."],
    ["findings", "ResearchFinding[]", "id, text, and the source ids under it."],
    ["usage · model", "ResearchTurnUsage · string", "Requests, tokens, cost, and which model was named for this call."],
    ["askedAt · answeredAt · updatedAt", "number · number? · number", "No revision: a turn is written twice and never edited by a person."]
  ];

  const toolTable = [
    ["retrieve", "query · topK ≤ 20", "querySemanticOverlay", "Passages of the project's own words, each with a source id.", "Built only for a retrieve grant, and forced first when it is"],
    ["retrieve_materials", "query · kinds? · topK ≤ 20", "querySemanticMaterials", "Descriptions of tables, charts, images and code. Interpretation, not exact contents.", "Free"],
    ["read_text", "kind · id · from · to", "readSemanticResourceForModel · sliceByCoordinates", "A stretch of one resource exactly as written, at most twelve thousand characters.", "resource.read grant; refuses a resource outside the turn's scope"],
    ["read_table", "materialHandle · rowFrom? · rowTo?", "the authored block behind the material", "A table's actual cells, up to two hundred rows. The only way to get the numbers in one.", "resource.read grant; the handle must have been issued this turn"],
    ["list_resources", "—", "rowsIn over documents, decks and spreadsheets", "What the project holds, by name and kind.", "resource.read grant"],
    ["submit_answer", "the whole decision", "records it in the closure", "An acknowledgement. The turn's answer arrives here.", "Named as the port's finalTool, so calling it ends the run"]
  ];

  const artefacts = [
    {
      n: 1,
      title: "A tool call reads; it does not write",
      body: "Every one of the five reading tools takes from the store and issues source ids into a Map that lives for the length of the turn. None of them creates or updates a row. The only writes during a run belong to the semantic overlay, and they happen before the loop starts rather than inside it."
    },
    {
      n: 2,
      title: "The answer is published in one write, at the end",
      body: "The turn row is created once as running and updated once when the answer settles. A table the model made would be built by its tool call, held in the same per-turn Map as the sources, and land in that single update as another entry in blocks. Nothing partial is ever visible."
    },
    {
      n: 3,
      title: "Which is the answer to the artefact question",
      body: "Make the block during the run, so the tool can validate it and the model can be told it was refused. Store it at the end, in the one write that publishes the turn. Streaming it as it is made would mean a half-written answer is a readable row, and every reader would need to know which half to trust."
    },
    {
      n: 4,
      title: "Nothing reaches the project until a person puts it there",
      body: "A block lives on its turn. Add, on a made block, is what writes it into a deck or a document. A chat that produced six drafts leaves six turns and no resources."
    }
  ];

  const steering = [
    ["Stop, and answer now", "Yes", "The control becomes Stop while a turn runs. Pressing it marks the flight and stamps the row; every tool then answers that the person wants an answer, and the model submits what it has.", "Built"],
    ["Cancel", "Yes", "The control becomes Cancel after the first press. Pressing again aborts the provider request and the turn is written cancelled.", "Built"],
    ["Correct it mid-answer", "No", "There is no channel for text into a running loop, only for the decision to end it.", "A note on the turn row, read between rounds and appended as a user message."],
    ["Watch it work", "Partly", "The centre shows that it is reading, and says wrapping up once a stop is asked for. The tool calls are not shown as they land.", "The turn is already written as running; the calls would need to be written as they happen."],
    ["Ask the next thing", "No", "One conversation answers one question at a time, and ask refuses while a turn is live here.", "Nothing. This one is deliberate."]
  ];

  const recovery = [
    {
      n: 1,
      title: "Nothing survives a restart, so a running row is a claim to check",
      body: "A turn runs inside the request that made it. The one thing that says it is still running is a registry in this process, and that registry is empty after a restart. A row that says running and is not in it was stranded, and the two places that notice do different things about it."
    },
    {
      n: 2,
      title: "A read reports it, and writes nothing",
      body: "The projection reports a stranded turn as failed with a reason. Reading is not the place to write, but it is the place to stop showing a person a spinner that will never resolve."
    },
    {
      n: 3,
      title: "The next question repairs it",
      body: "ask checks the registry before it refuses. A running turn nobody is running is marked failed with the reason, and the new question proceeds. That is the only way a stranded turn could block somebody, and it no longer does."
    },
    {
      n: 4,
      title: "One turn is one write, or none of it",
      body: "Appending the question, opening the turn and naming the chat are three tables. They are staged in one unit of work and cross one commit boundary: a journal names every table's next value, then each file is replaced, then the journal is removed. A process that stops between those files finds the journal on the next start and finishes the same decision before it serves a read."
    },
    {
      n: 5,
      title: "What it does not protect against",
      body: "A write is durable and a set of writes is all-or-none, so neither a torn file nor a half-applied turn is possible. What is possible is a turn that was genuinely running when the process stopped. That is exactly the state the reclaim turns into a failed turn with a reason."
    }
  ];

  const notBuilt = [
    ["A queue", "The turn runs inside the request that created it. A crash is recovered rather than resumed, and a second browser sees nothing until the first one's request returns.", "The derived output refresh queue is the pattern: one durable job row, one in-process flight."],
    ["Streaming", "completeWithTools answers once. Message.state has a streaming value and nothing writes it.", "A second method on the port; the surfaces would not change."],
    ["Web search", "The composer shows the toggle disabled. ask accepts the tool id and no tool implements it.", "One tool, and a decision about what an unbounded source cites."],
    ["Question and Hypothesis modes", "Both are stored on the thread and neither changes what happens.", "A mode that binds the thread to a question or a hypothesis row and writes findings against it."],
    ["Made blocks", "The renderer switches on block type and only text is ever produced.", "A make_table tool, then the chart system."]
  ];
</script>

<ReferenceShell {page} {project}>
  <ReferenceSection
    id="separate"
    kicker="What this is"
    title="A system of its own, next to the agents one"
    lede="Research chat and the agents category are two systems. They are drawn side by side in this suite because they were built by the same hands in the same week, not because they share machinery. This page is the whole of research chat: what it stores, what runs over it, and in what order."
  >
    <Callouts items={separate} scope="separate" />
    <Noted scope="figure" label="The system">
      <Diagram
        label="Every file that takes part, and what it reaches"
        source={SYSTEM_DIAGRAM}
        caption="Four surfaces and one read model above; one capability in the middle; the overlay, the intelligence port and the store below. Nothing here touches the agents capability."
        minHeight="30rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="capabilities"
    kicker="Capabilities"
    title="One it owns, and five it reaches"
    lede="A capability may name another only at its index, so this list is also the complete set of import edges out of research-chat."
  >
    <SpecTable
      label="Capabilities"
      columns={["Capability or object", "Entered at", "What it provides", "Relationship"]}
      rows={capabilities}
      mono={[0, 1]}
      noted="capability"
    />
  </ReferenceSection>

  <ReferenceSection
    id="state"
    kicker="State"
    title="Four tables, two of them its own"
    lede="A chat is a research thread. A turn is a row beside the response message it explains. Everything a person types and everything the model answers ends up in one of these four."
  >
    <SpecTable
      label="Tables"
      columns={["Table", "Fields", "What it is", "Ownership"]}
      rows={tables}
      mono={[0]}
      noted="table"
    />
    <Noted scope="figure" label="How they relate">
      <Diagram
        label="The four tables and their keys"
        source={STATE_DIAGRAM}
        caption="A turn points at its chat, at the thread that chat is, and at the two messages it sits between. It carries no revision because nobody edits a turn."
        minHeight="34rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="turn-row"
    kicker="State"
    title="The turn, field by field"
    lede="Why a turn is a row rather than a longer message: a Message carries what was said, and none of this is what was said. It is what the run did."
  >
    <SpecTable
      label="researchTurns"
      columns={["Field", "Type", "What it holds and why"]}
      rows={turnFields}
      mono={[0, 1]}
      noted="field"
    />
    <Noted scope="figure" label="Turn states">
      <Diagram
        label="What a turn can be, and what moves it"
        source={TURN_STATE_DIAGRAM}
        caption="Three ends, and no way back. insufficient is not a failure: the run completed and found nothing it could stand behind."
        minHeight="20rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="chains"
    kicker="Procedures"
    title="Every procedure, end to end"
    lede="What each one takes, every step it performs with the function that performs it, what it writes, what it refuses and what it refreshes afterwards. Two are internal: they are not remote functions, and they are here because the whole of ask is in them."
  >
    <div class="ar-chains">
      {#each RESEARCH_CHAINS as chain (chain.name)}
        <ProcedureChain {chain} />
      {/each}
    </div>
  </ReferenceSection>

  <ReferenceSection
    id="turn"
    kicker="Execution"
    title="One question, from the composer to the panes"
    lede="The order matters more than any single step. Read it as three phases: the request is admitted and the turn opened, the project is brought up to date, then one bounded loop runs and the answer is published in a single write."
  >
    <Noted scope="figure" label="A turn">
      <Diagram
        label="Asking a question, end to end"
        source={TURN_DIAGRAM}
        caption="Every arrow into the store is a state change. There are four before the loop, two after it, and none during."
        minHeight="42rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="tools"
    kicker="Execution"
    title="What happens on a tool call"
    lede="The loop lives inside the intelligence port, so the capability never writes a round-trip. It describes tools and asks once; runAgent parses, executes, appends the result and asks again, with no round limit. Every tool is wrapped so that once a stop is asked for it answers that instead of searching, which is what ends a run that would otherwise not stop."
  >
    <Noted scope="figure" label="One tool call">
      <Diagram
        label="A single round of the loop"
        source={TOOL_DIAGRAM}
        caption="A tool that throws is not a failed turn. The message goes back to the model as an ordinary result and the next round begins."
        minHeight="28rem"
      />
    </Noted>
    <SpecTable
      label="The five tools"
      columns={["Tool", "Takes", "Reaches", "Returns", "Gate"]}
      rows={toolTable}
      mono={[0, 1, 2]}
      noted="tool"
    />
  </ReferenceSection>

  <ReferenceSection
    id="artefacts"
    kicker="Execution"
    title="When the answer makes something"
    lede="The question of whether a table is built as it goes or gathered at the end, answered once so every later block kind follows the same rule."
  >
    <Callouts items={artefacts} scope="artefact" />
  </ReferenceSection>

  <ReferenceSection
    id="recovery"
    kicker="Execution"
    title="Recovery: what happens when something goes wrong"
    lede="Two mechanisms, at two levels. One notices a turn nobody is running any more. The other keeps the last good version of every table on disk, so a bad write is an inconvenience rather than the end of the data."
  >
    <Callouts items={recovery} scope="recovery" />
    <Noted scope="figure" label="Recovery">
      <Diagram
        label="A stranded turn, and a table write"
        source={RECOVERY_DIAGRAM}
        caption="The registry is the only thing that knows a turn is live. That it is empty after a restart is what makes the check exact rather than a guess about elapsed time."
        minHeight="34rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="steering"
    kicker="Execution"
    title="Stop, then cancel"
    lede="Stop does not mean throw it away. The first press asks the model to answer now, from what it has already read; the control then becomes Cancel, so a second press abandons the run. A double press is therefore a cancellation, and a single press is a partial answer."
  >
    <SpecTable
      label="Steering"
      columns={["Wanted", "Today", "How", "State"]}
      rows={steering}
      pills={[1]}
      noted="steer"
    />
    <Noted scope="figure" label="Steering">
      <Diagram
        label="Stopping, and then cancelling"
        source={STEER_DIAGRAM}
        caption="The first press writes to the row so a reload still shows Cancel. The second reaches the provider request itself."
        minHeight="36rem"
      />
    </Noted>
  </ReferenceSection>

  <ReferenceSection
    id="not-built"
    kicker="Honestly"
    title="Six things that are not there"
    lede="Stated plainly so this page is read as a specification of what exists rather than of what is intended."
  >
    <SpecTable
      label="Not built"
      columns={["Missing", "What that means today", "What it would take"]}
      rows={notBuilt}
      noted="missing"
    />
  </ReferenceSection>

  <ReferenceSection
    id="questions"
    kicker="Forks on this page"
    title="Decisions research chat raised"
    lede="Answer by number."
  >
    <Questions questions={questionsFor("research-chat")} />
  </ReferenceSection>
</ReferenceShell>
