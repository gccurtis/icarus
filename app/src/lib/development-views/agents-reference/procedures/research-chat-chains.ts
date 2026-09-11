import type { Chain } from "$development-views/agents-reference/types";

export const RESEARCH_CHAINS: readonly Chain[] = [
  {
    name: "readThreads",
    kind: "query",
    file: "capabilities/research-chat/api/read-threads/read-threads.ts",
    input: [],
    output: [
      { name: "threads", type: "ThreadItem[]", note: "Newest first, by the newest turn's updatedAt." },
      { name: "ThreadItem.id", type: "string", note: "The researchThreads row id." },
      { name: "ThreadItem.title", type: "string" },
      { name: "ThreadItem.mode", type: "\"explore\" | \"question\" | \"hypothesis\"" },
      { name: "ThreadItem.turnCount", type: "number", note: "Derived by counting turns, not stored." },
      { name: "ThreadItem.lastLine", type: "string | null", note: "The newest turn's question, else the thread's last message." },
      { name: "ThreadItem.updatedAt", type: "number" }
    ],
    steps: [
      { does: "Establish who is asking and about which project, before anything else.", calls: "requireScope()" },
      { does: "Take the one store off the server model.", calls: "serverModel().store" },
      { does: "Read every research thread in the project.", calls: "threadsIn(store, scope.projectId)" },
      { does: "Turn each row into what a panel reads, counting its turns and finding its last line.", calls: "threadItem(store, row)" },
      { does: "Order by when each was last spoken to.", calls: "toSorted((l, r) => r.updatedAt - l.updatedAt)" }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "readThread",
    kind: "query",
    file: "capabilities/research-chat/api/read-thread/read-thread.ts",
    input: [{ name: "threadId", type: "string", note: "A researchThreads row id." }],
    output: [
      { name: "thread", type: "ThreadItem" },
      { name: "turns", type: "TurnItem[]", note: "Oldest first, by askedAt." },
      { name: "null", type: "when no visible thread has that id", note: "An absence, not a refusal." }
    ],
    steps: [
      { does: "Establish the scope.", calls: "requireScope()" },
      { does: "Check the input is an object with a non-blank threadId.", calls: "validateReadThread(input)" },
      { does: "Find the thread among the project's own.", calls: "threadsIn(store, projectId).find(...)" },
      { does: "Answer null if it is not there.", calls: "return null" },
      { does: "Project the thread and every turn on it.", calls: "threadItem(store, row) · turnsIn(...).map(turnItem)" }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "createThread",
    kind: "command",
    file: "capabilities/research-chat/api/create-thread/create-thread.ts",
    input: [{ name: "title", type: "string, optional", note: "One to two hundred characters. Absent means New chat." }],
    output: [{ name: "threadId", type: "string", note: "The researchThreads row id, which is what a tab carries." }],
    steps: [
      { does: "Establish the scope.", calls: "requireScope()" },
      { does: "Validate the optional title.", calls: "validateCreateThread(input)" },
      { does: "Open the conversation primitive shared with tasks and persona chats.", calls: "store.create(\"threads\", { projectId, kind: \"researchThread\" })", writes: "threads" },
      { does: "Open its first part with no messages in it.", calls: "store.create(\"threadParts\", { part: 1, messages: [] })", writes: "threadParts" },
      { does: "Create the chat itself, in explore mode, owned by the viewer.", calls: "store.create(\"researchThreads\", { title, mode: { kind: \"explore\" }, createdBy: viewer(scope) })", writes: "researchThreads" }
    ],
    refuses: [],
    refreshes: ["readThreads()"]
  },
  {
    name: "ask",
    kind: "command",
    file: "capabilities/research-chat/api/ask/ask.ts",
    input: [
      { name: "threadId", type: "string" },
      { name: "text", type: "string", note: "Trimmed, at most four thousand characters." },
      { name: "scope", type: "ResearchScope, optional", note: "The whole project, or one resource. Defaults to the project." },
      { name: "tools", type: "ResearchToolId[], optional", note: "Filtered against the closed list; only web.search exists and it does nothing." }
    ],
    output: [
      { name: "accepted", type: "true", note: "True even when the turn failed: the turn was made, and its row says how it ended." },
      { name: "threadId", type: "string" },
      { name: "turnId", type: "string" },
      { name: "accepted: false", type: "with reason and detail", note: "Only when the chat is missing or already working." }
    ],
    steps: [
      { does: "Establish the scope, then validate the input. The gate comes first because a type is a claim about what a caller said it sent.", calls: "requireScope() · validateAsk(input)" },
      { does: "Find the chat among the project's own.", calls: "threadsIn(store, projectId).find(...)" },
      { does: "Refuse if a turn on this chat is already running and this process is running it. One conversation answers one question at a time.", calls: "turnsIn(...).find(state queued or running) · isStranded(id)" },
      { does: "If a turn says running and no process is running it, it was stranded by a restart. Mark it failed with the reason and carry on rather than refusing forever.", calls: "reclaim(model, running._id)", writes: "researchTurns.state · error" },
      { does: "Read the persona this chat answers as, if it has one, and refuse if it has left the project.", calls: "personaFor(model, projectId, thread.personaId)" },
      { does: "Translate its grants into tool families, and refuse a persona that may not read the project at all.", calls: "orderedTools(persona.tools)" },
      { does: "Take the persona's own scope as the run's outer bound. Every tool is gated on it and on the turn's chosen scope, so a scoped persona cannot reach past its set by opening a chat." },
      { does: "Append the question to the thread as a prompt message authored by the viewer.", calls: "textMessage(...) · append(model, projectId, thread.threadId, prompt)", writes: "threadParts.messages" },
      { does: "Open the turn as running, carrying the mode, the scope and the tools it was asked with.", calls: "store.create(\"researchTurns\", { state: \"running\", ... })", writes: "researchTurns" },
      { does: "Name the chat from its first question when it is still called New chat.", calls: "store.update(`researchThreads.${id}.title`, titleFrom(text))", writes: "researchThreads.title" },
      { does: "Gather the last four answered turns as context for continuity, not as evidence.", calls: "turnsIn(...).filter(answered).slice(-4)" },
      { does: "Bring the project's semantic overlay up to date. A chat is a pull boundary: nothing else guarantees the overlay is current at the moment somebody asks.", calls: "prepareOverlay(model, projectId)", writes: "semanticSyncJobs · semanticSources · semanticObjects · semanticIndexes" },
      { does: "Read the three configured numbers, refusing a configuration that is out of range.", calls: "configuredInteger(model, \"intelligence.chat.topK\") · maxSources · configuredString(\"intelligence.chat.model\")" },
      { does: "Register the run on the server-owned operation object so a stop can reach it and a restart can tell it apart from a stranded row.", calls: "operationFlights.beginResearch(turnId)" },
      { does: "Arm the run's deadline. The port's timeout bounds one provider request, so an unbounded loop of them is only bounded by this.", calls: "operationFlights.armResearchDeadline(turnId, intelligence.chat.deadlineMs)" },
      { does: "Run the answer. The only step that talks to a provider, and it writes nothing. The persona's definition goes in the system prompt and its grants decide the tools.", calls: "answerQuestion({ persona: personaPrompt(persona), grants, stopping, signal, ... })" },
      { does: "Append the answer to the thread as a response message authored by the system.", calls: "textMessage(...) · append(...)", writes: "threadParts.messages" },
      { does: "Publish the turn: blocks, queries, sources, findings, usage, model and the state the model reached.", calls: "store.update(`researchTurns.${turnId}`, { ... })", writes: "researchTurns" },
      { does: "Record what happened, with the counts that diagnose a thin answer.", calls: "observability.logger.info(\"researchChat.answered\", { queries, returned, said, offered, sources, tokens })" },
      { does: "On a throw, write cancelled when the run was aborted and failed otherwise, with the message stripped of any credential.", writes: "researchTurns.state · error" },
      { does: "Release the server-owned flight, whatever happened.", calls: "operationFlights.endResearch(turnId)" }
    ],
    refuses: [
      { reason: "not-found", when: "no chat in this project has that id" },
      { reason: "invalid-state", when: "this chat is still working on the last question" }
    ],
    refreshes: ["readThreads()", "readThread({ threadId })", "read(\"researchThreads\")"]
  },
  {
    name: "stopTurn",
    kind: "command",
    file: "capabilities/research-chat/api/stop-turn/stop-turn.ts",
    input: [
      {
        name: "threadId",
        type: "string",
        note: "The chat, not the turn: the turn being stopped is the one the request in flight is still making, so its id has not reached the browser."
      }
    ],
    output: [
      { name: "outcome", type: "\"answering\" | \"cancelled\"", note: "Which press this was." },
      { name: "accepted: false", type: "with a detail", note: "Not this project's, not running, or not running here." }
    ],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateStopTurn" },
      { does: "Find the chat, then the turn running in it.", calls: "threadsIn(...) · turnsIn(...).find(running or queued)" },
      { does: "Ask the server-owned operation object to stop the flight. A turn running in another process cannot be stopped from this one.", calls: "operationFlights.requestResearchStop(turn._id)" },
      { does: "First press: the owner marks the flight stopping and the capability stamps the row, so a reload still shows Cancel.", calls: "requestResearchStop → answering", writes: "researchTurns.stopRequestedAt" },
      { does: "Second press: the owner aborts the controller, which abandons the provider request in flight.", calls: "requestResearchStop → cancelled" }
    ],
    refuses: [
      { reason: "no turn in this project has that id", when: "the id is not this project's" },
      { reason: "that turn is not running", when: "it already settled" },
      { reason: "that turn is not running here", when: "this ServerModel owns no flight for it, so it was stranded or belongs to another process" }
    ],
    refreshes: []
  },
  {
    name: "setThreadPersona",
    kind: "command",
    file: "capabilities/research-chat/api/set-thread-persona/set-thread-persona.ts",
    input: [
      { name: "threadId", type: "string" },
      { name: "personaId", type: "string | null", note: "null answers as nobody." }
    ],
    output: [{ name: "accepted", type: "true, with the threadId" }],
    steps: [
      { does: "Establish the scope and validate.", calls: "requireScope() · validateSetThreadPersona" },
      { does: "Find the chat, then the persona, both in this project." },
      { does: "Write or remove the field. Past turns keep the prompt they were answered under.", writes: "researchThreads.personaId" }
    ],
    refuses: [
      { reason: "no chat in this project has that id", when: "the chat is not this project's" },
      { reason: "no persona in this project has that id", when: "the persona is not this project's" }
    ],
    refreshes: ["readThreads()", "readThread({ threadId })"]
  },
  {
    name: "answerQuestion",
    kind: "internal",
    file: "capabilities/research-chat/api/shared/answer.ts",
    input: [
      { name: "model", type: "ServerModel", note: "For the store, the intelligence and the material content." },
      { name: "projectId", type: "Id<\"projects\">" },
      { name: "scope", type: "ResearchScope" },
      { name: "question", type: "string" },
      { name: "persona", type: "string, optional", note: "The persona's definition, already rendered as prompt text." },
      { name: "grants", type: "ToolId[]", note: "Which tool families to build." },
      { name: "stopping", type: "() => boolean", note: "Read before every tool call." },
      { name: "signal", type: "AbortSignal, optional" },
      { name: "history", type: "{ asked, answered }[]", note: "At most four, for continuity only." },
      { name: "topK", type: "number" },
      { name: "maxSources", type: "number" },
      { name: "chatModel", type: "string" },
      { name: "maxToolRounds", type: "number", note: "-1 for this caller. A conversation is not one synthesis, and the bound is per call rather than per process." },
      { name: "bound", type: "ResourceSet, optional", note: "The persona's own scope, enforced on every tool." }
    ],
    output: [
      { name: "status", type: "\"answered\" | \"insufficient\"" },
      { name: "blocks", type: "ContentBlock[]", note: "Paragraphs today. The shape a table or a chart joins." },
      { name: "sources", type: "ResearchSource[]", note: "Only ids the tools actually issued, capped at maxSources." },
      { name: "findings", type: "ResearchFinding[]" },
      { name: "queries", type: "string[]" },
      { name: "returned", type: "number[]", note: "Passages handed back per search. Diagnostic." },
      { name: "said · offered · repaired", type: "diagnostics", note: "What the model claimed, how many it cited, whether the repair ran." },
      { name: "usage", type: "ResearchTurnUsage" }
    ],
    steps: [
      { does: "Build the tools for this one turn, closed over the project, the scope and the grants. Each is wrapped so that once a stop is asked for it answers \"answer now\" instead of searching.", calls: "createToolSession({ model, projectId, scope, topK, grants, stopping })" },
      { does: "Ask once. The rounds happen inside the port, not here.", calls: "intelligence.completeWithTools({ system, user, tools, firstTool: \"retrieve\", model })" },
      { does: "Take the decision the model delivered through submit_answer, or an empty insufficient one if it never called it." },
      { does: "If it answered and cited nothing, hand the passages and the draft back once, with no tools.", calls: "citeAgain(input, decision, session.issued())" },
      { does: "Keep only source ids the session actually issued, and collect what each was used for.", calls: "session.sourceOf(id)" },
      { does: "Keep the findings when there is an answer, dropping source ids that were not kept." },
      { does: "Split the response on blank lines into text blocks.", calls: "textBlocks(decision.response)" }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "prepareOverlay",
    kind: "internal",
    file: "capabilities/research-chat/api/shared/overlay.ts",
    input: [
      { name: "model", type: "ServerModel" },
      { name: "projectId", type: "Id<\"projects\">" }
    ],
    output: [{ name: "indexed", type: "number", note: "How many resources were enqueued this time." }],
    steps: [
      { does: "List every document and presentation in the project.", calls: "rowsIn(store, \"documents\") · rowsIn(store, \"presentations\")" },
      { does: "Skip anything already indexed at its current revision.", calls: "semanticSourceIsCurrent(store, projectId, source)" },
      { does: "Enqueue the rest for the overlay.", calls: "enqueueSemanticSync({ ref })", writes: "semanticSyncJobs" },
      { does: "Drain the queue in batches of twenty-five, at most twenty batches.", calls: "processSemanticSyncQueueFor(model, projectId, 25)", writes: "semanticSources · semanticObjects · semanticIndexes · semanticMaterials" },
      { does: "Throw on the first job that failed, and throw if the queue never settles." }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "removeThread",
    kind: "command",
    file: "capabilities/research-chat/api/remove-thread/remove-thread.ts",
    input: [{ name: "threadId", type: "string" }],
    output: [
      { name: "accepted", type: "boolean" },
      { name: "threadId", type: "string" },
      { name: "detail", type: "string", note: "Present only on a refusal." }
    ],
    steps: [
      { does: "Establish the scope and validate the input.", calls: "requireScope() · validateRemoveThread(input)" },
      { does: "Find the chat; refuse if it is not this project's.", calls: "threadsIn(store, projectId).find(...)" },
      { does: "Refuse while a turn is queued or running, so nothing is removed from under a run." },
      { does: "Remove the turns, then the thread parts, then the thread, then the chat.", calls: "store.removeRows(...) four times", writes: "researchTurns · threadParts · threads · researchThreads" }
    ],
    refuses: [
      { reason: "not-found", when: "no chat in this project has that id" },
      { reason: "in flight", when: "it is still answering" }
    ],
    refreshes: ["readThreads()"]
  }
];
