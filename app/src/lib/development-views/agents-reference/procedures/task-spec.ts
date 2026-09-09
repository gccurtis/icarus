import type { Chain } from "$development-views/agents-reference/types";

export const TASK_STATE = `erDiagram
  PERSONAS ||--o{ AGENTTASKS : "gates visibility of"
  AUTOMATIONS ||--o{ AGENTTASKS : "fires"
  AGENTTASKS ||--|| THREADS : "opens one"
  THREADS ||--|{ THREADPARTS : "holds messages in"

  AGENTTASKS {
    string title "a person writes it"
    string instruction "a person writes it"
    id personaId "chosen at creation, never patchable"
    TaskOrigin origin "person, or automation"
    AgentTaskState state "running, review, finished"
    ResourceSet scope "optional"
    ToolId-array tools "copied from the persona when absent"
    PlanStep-array plan "a runner writes it, so always empty"
    TaskOutput-array outputs "a runner writes it, so always empty"
    TaskQuestion-array questions "a runner asks, a person settles"
    Actor createdBy "the viewer"
    number startedAt "creation time"
    number finishedAt "optional, set when a person finishes it"
    Actor reviewedBy "optional, whoever pressed the button"
    number revision "compare-and-swap"
  }
  THREADPARTS {
    number part "always 1 today"
    Message-array messages "every one is a prompt"
  }`;

export const TASK_LIFECYCLE = `stateDiagram-v2
  [*] --> running: createTask or runAutomation
  running --> finished: a person presses Stop
  review --> finished: a person presses Mark reviewed
  running --> review: nothing writes this
  finished --> [*]
  note right of review
    reachable in the type, in the
    filters and in three surfaces.
    No code writes it, because the
    runner that would does not exist
  end note
  note left of running
    plan, outputs and questions stay
    empty; progress stays null
  end note`;

export const TASK_CREATE = `sequenceDiagram
  autonumber
  participant P as Person
  participant S as content/task.svelte
  participant R as index.remote.ts
  participant C as create-task.ts
  participant T as shared/threads.ts
  participant D as store

  P->>S: names it, writes the instruction, picks a persona
  S->>R: createTask(personaId, title, instruction, scope?, tools?)
  R->>C: createTask(input)
  C->>C: requireScope, then validateCreateTask
  C->>D: findVisible personas
  alt the persona is not visible
    C-->>S: refused not-found
  else
    C->>T: openThread(store, projectId, "agentTask", at, the instruction as a prompt)
    T->>D: create the threads row
    T->>D: create threadParts part 1, one message
    C->>D: create the agentTasks row, running, empty plan
    C-->>R: accepted, id, revision 1
    R->>R: readAgentsLibrary().refresh
  end
  Note over C,D: and then nothing. No runner reads the row`;

export const TASK_RUNNER = `flowchart TB
  subgraph now["what exists"]
    create["createTask writes state running, plan empty"]
    read["readTask projects plan, outputs, questions, turns"]
    person["a person may finish it, message it, answer a question"]
  end

  subgraph missing["what a runner would need, and none of it exists"]
    claim["a way to claim a task"]
    plan["a procedure that writes plan steps"]
    step["a procedure that advances a step"]
    output["a procedure that appends an output"]
    askq["a procedure that asks a question"]
    respond["a way to append a response message authored by the agent"]
    review["a transition into review"]
  end

  create --> claim
  claim --> plan
  plan --> step
  step --> output
  step --> askq
  askq -.->|"a person answers, which already works"| step
  output --> review
  respond --> review
  review --> person

  note["updateTask cannot serve: its validator rejects any state but finished, and its allowed patch keys exclude plan, outputs and questions"]`;

export const TASK_CHAINS: readonly Chain[] = [
  {
    name: "createTask",
    kind: "command",
    file: "capabilities/agents/api/create-task/create-task.ts",
    input: [
      { name: "personaId", type: "string" },
      { name: "title", type: "string", note: "At most 160 characters." },
      { name: "instruction", type: "string", note: "At most 20,000." },
      { name: "scope", type: "ResourceSet, optional" },
      { name: "tools", type: "ToolId[], optional", note: "Absent means a copy of the persona's." }
    ],
    output: [{ name: "accepted", type: "true, with the id and revision 1" }],
    steps: [
      { does: "Establish the scope, then validate.", calls: "requireScope() · validateCreateTask" },
      { does: "Find the persona. This is the only thing that can refuse.", calls: "findVisible(store, scope, \"personas\", personaId)" },
      { does: "Open the conversation and put the instruction in it as the first message.", calls: "openThread(store, projectId, \"agentTask\", at, { role: \"prompt\", author, text })", writes: "threads · threadParts" },
      { does: "Write the task as running, with an empty plan, no outputs and no questions.", calls: "store.create(\"agentTasks\", fields)", writes: "agentTasks" }
    ],
    refuses: [{ reason: "not-found", when: "no visible persona has that id" }],
    refreshes: ["readAgentsLibrary()"]
  },
  {
    name: "updateTask",
    kind: "command",
    file: "capabilities/agents/api/update-task/update-task.ts",
    input: [
      { name: "taskId", type: "string" },
      { name: "baseRevision", type: "number" },
      { name: "patch.title", type: "string, optional" },
      { name: "patch.instruction", type: "string, optional" },
      { name: "patch.scope", type: "ResourceSet | null, optional" },
      { name: "patch.tools", type: "ToolId[], optional" },
      { name: "patch.state", type: "\"finished\", optional", note: "The only state a person may set. Anything else throws." }
    ],
    output: [{ name: "accepted", type: "true, with the new revision" }],
    steps: [
      { does: "Establish the scope and validate. A patch whose state is not finished is rejected before the store is read.", calls: "requireScope() · validateUpdateTask" },
      { does: "Find the task, then compare and swap on the revision.", calls: "findVisible(store, scope, \"agentTasks\", taskId)" },
      { does: "Refuse an instruction change once a plan exists. Dead today, because no plan ever exists." },
      { does: "Refuse a state, tools or scope change on a finished task. A title or an instruction may still be edited." },
      { does: "Finishing stamps finishedAt if it is not already set, and reviewedBy as the viewer." },
      { does: "Replace the whole row at revision plus one. plan, outputs, questions and origin ride through untouched.", calls: "store.update(`agentTasks.${id}`, fields)", writes: "agentTasks" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible task has that id" },
      { reason: "stale", when: "the revision moved" },
      { reason: "invalid-state", when: "the agent has started on the instruction it was given" },
      { reason: "invalid-state", when: "a finished task does not change" }
    ],
    refreshes: ["readAgentsLibrary()", "readTask({ taskId })"]
  },
  {
    name: "readTask",
    kind: "query",
    file: "capabilities/agents/api/read-task/read-task.ts",
    input: [{ name: "taskId", type: "string" }],
    output: [
      { name: "TaskDetail", type: "TaskItem plus instruction, plan, outputs, questions, turns, reviewedByName" },
      { name: "progress", type: "TaskProgress", note: "done, total, percent, current. Derived, never stored." },
      { name: "turns", type: "TaskTurn[]", note: "The thread, flattened: from, authorName, text, at." },
      { name: "null", type: "when it is not visible" }
    ],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateReadTask" },
      { does: "Find the task among the visible ones.", calls: "findVisible(...)" },
      { does: "Project it, deriving the progress from the plan and counting the open questions.", calls: "taskDetail(store, row, visible) · planProgress · openQuestions" },
      { does: "Read the conversation by flattening every part of its thread in order.", calls: "turnsOf → messagesOf(store, threadId) · messageText" }
    ],
    refuses: [],
    refreshes: []
  },
  {
    name: "sendTaskMessage",
    kind: "command",
    file: "capabilities/agents/api/send-task-message/send-task-message.ts",
    input: [
      { name: "taskId", type: "string" },
      { name: "text", type: "string", note: "Trimmed, non-empty, at most 20,000." }
    ],
    output: [{ name: "accepted", type: "true, with the revision unchanged", note: "Talking is not editing, so the revision does not move." }],
    steps: [
      { does: "Establish the scope and validate.", calls: "requireScope() · validateSendTaskMessage" },
      { does: "Find the task.", calls: "findVisible(...)" },
      { does: "Refuse if it is finished." },
      { does: "Append the message to the last part of its thread.", calls: "appendMessage(store, projectId, threadId, \"prompt\", viewer(scope), at, text)", writes: "threadParts.messages" },
      { does: "Touch the task's clock only.", calls: "store.update(`agentTasks.${id}.updatedAt`, at)", writes: "agentTasks.updatedAt" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible task has that id" },
      { reason: "invalid-state", when: "the task is finished, so nothing reads its thread" }
    ],
    refreshes: ["readTask({ taskId })"]
  },
  {
    name: "answerTaskQuestion",
    kind: "command",
    file: "capabilities/agents/api/answer-task-question/answer-task-question.ts",
    input: [
      { name: "taskId", type: "string" },
      { name: "questionId", type: "string" },
      { name: "answer", type: "string, optional", note: "Exactly one of answer or reject." },
      { name: "reject", type: "boolean, optional", note: "Hands the judgement back to the agent." }
    ],
    output: [{ name: "accepted", type: "true, with the revision unchanged" }],
    steps: [
      { does: "Establish the scope and validate. Both an answer and a rejection, or neither, throws.", calls: "requireScope() · validateAnswerTaskQuestion" },
      { does: "Find the task, then the question inside its questions array.", calls: "findVisible(...) · task.questions.find(...)" },
      { does: "Refuse if that question is already settled, or if the task is finished.", calls: "isOpen(question)" },
      { does: "Rebuild the questions array with that one entry replaced. A rejection sets rejectedAt and answeredBy but no answer." },
      { does: "Append what was said to the thread, before the row is written.", calls: "appendMessage(...)", writes: "threadParts.messages" },
      { does: "Write the questions array and the clock, as two field-path updates.", calls: "store.update(`agentTasks.${id}.questions`, questions)", writes: "agentTasks.questions" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible task has that id" },
      { reason: "not-found", when: "the task asked no question with that id" },
      { reason: "invalid-state", when: "that question was already settled" },
      { reason: "invalid-state", when: "the task is finished, so the answer would reach nobody" }
    ],
    refreshes: ["readAgentsLibrary()", "readTask({ taskId })"]
  }
];
