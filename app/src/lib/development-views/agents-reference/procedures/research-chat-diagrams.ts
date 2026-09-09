export const SYSTEM_DIAGRAM = `flowchart LR
  subgraph views["app-views / categories / research"]
    thread["content/thread.svelte"]
    threads["context/threads.svelte"]
    turns["context/turns.svelte"]
    lens["inspector/turn.svelte"]
    proc["procedures/chat.svelte.ts"]
  end

  subgraph cap["capabilities / research-chat"]
    remote["index.remote.ts"]
    ask["api/ask/ask.ts"]
    answer["api/shared/answer.ts"]
    tools["api/shared/tools.ts"]
    overlay["api/shared/overlay.ts"]
    project["api/shared/projection.ts"]
  end

  subgraph other["what it reaches"]
    semantic["capabilities/semantic-overlay"]
    intel["model/server/intelligence"]
    store[("model/server/store")]
    openrouter{{"OpenRouter"}}
    jina{{"Jina"}}
  end

  thread --> proc
  threads --> proc
  turns --> proc
  lens --> proc
  proc --> remote
  remote --> ask
  remote --> project
  ask --> overlay
  ask --> answer
  answer --> tools
  answer --> intel
  tools --> semantic
  overlay --> semantic
  semantic --> jina
  intel --> openrouter
  ask --> store
  project --> store
  semantic --> store`;

export const STATE_DIAGRAM = `erDiagram
  PERSONAS ||--o{ RESEARCHTHREADS : "answers as"
  THREADS ||--|{ THREADPARTS : "holds messages in"
  RESEARCHTHREADS ||--|| THREADS : "is a"
  RESEARCHTHREADS ||--o{ RESEARCHTURNS : "has"
  RESEARCHTURNS }o--|| THREADPARTS : "names two messages in"

  PERSONAS {
    string name
    PersonaDefinition definition "becomes the system prompt"
    ToolId-array tools "become the tool set"
    id projectId "required: everything is project-gated"
  }
  THREADS {
    id projectId
    ThreadKind kind
    BranchPoint branchedFrom "optional"
  }
  THREADPARTS {
    id projectId
    id threadId
    number part
    Message-array messages
  }
  RESEARCHTHREADS {
    id projectId
    id threadId
    string title
    ResearchMode mode
    id personaId "optional: who it answers as"
    id-array findingIds
    Actor createdBy
    number updatedAt
  }
  RESEARCHTURNS {
    id projectId
    id researchThreadId
    id threadId
    string promptMessageId
    string messageId "optional"
    string prompt
    ResearchMode mode
    ResearchScope scope
    ResearchToolId-array tools
    ResearchTurnState state
    number stopRequestedAt "optional: asked to answer now"
    ContentBlock-array blocks
    string-array queries
    ResearchSource-array sources
    ResearchFinding-array findings
    ResearchTurnUsage usage "optional"
    string model "optional"
    string error "optional"
    number askedAt
    number answeredAt "optional"
    number updatedAt
  }`;

export const TURN_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person
  participant S as thread.svelte
  participant R as index.remote.ts
  participant A as ask.ts
  participant O as overlay.ts
  participant I as intelligence port
  participant T as tools.ts
  participant D as store

  P->>S: types, presses Send
  S->>R: ask(threadId, text, scope)
  R->>A: ask(input)
  A->>A: requireScope, validateAsk
  A->>D: find the thread, refuse if missing
  A->>D: refuse if a turn is queued or running
  A->>D: append the prompt message
  A->>D: create the turn, state running
  A->>D: title the thread from the question if it is new
  A->>O: prepareOverlay(model, projectId)
  O->>D: enqueue every resource not already current
  O->>D: drain the sync queue in batches of 25
  A->>I: completeWithTools(system, user, tools, firstTool retrieve)
  loop until submit_answer, unbounded
    I->>T: execute one tool call
    T->>D: read the store, issue source ids
    T-->>I: the result, as JSON
  end
  I-->>A: the submitted decision, usage, tool calls
  A->>D: append the response message
  A->>D: update the turn: blocks, sources, findings, usage, state
  A-->>R: accepted, threadId, turnId
  R->>R: readThreads().refresh, readThread().refresh
  R-->>S: the panes redraw`;

export const TOOL_DIAGRAM = `flowchart TB
  start(["the model asks for a tool"]) --> parse["runAgent parses the arguments as JSON"]
  parse -->|invalid| bad["result: ok false, with the parse error"]
  parse -->|valid| known{"is the name registered?"}
  known -->|no| unknown["result: ok false, unknown tool"]
  known -->|yes| exec["tool.execute(input)"]
  exec --> guard["the tool validates its own input and its scope"]
  guard -->|throws| failed["result: ok false, with the message"]
  guard -->|passes| work["read the store or the overlay"]
  work --> issue["issue a source id per distinct passage"]
  issue --> value["result: ok true, with the value"]
  bad --> back["appended as a tool message"]
  unknown --> back
  failed --> back
  value --> back
  back --> next["the next round begins"]
  next --> start`;

export const TURN_STATE_DIAGRAM = `stateDiagram-v2
  [*] --> running: ask creates the row
  running --> stopping: a person pressed Stop
  stopping --> answered: it submitted what it had
  stopping --> cancelled: pressed a second time
  running --> answered: the model submitted an answer with text
  running --> insufficient: it submitted nothing it could stand behind
  running --> failed: the overlay or the provider threw
  running --> failed: the process restarted, found by the next ask
  answered --> [*]
  insufficient --> [*]
  failed --> [*]
  cancelled --> [*]
  note right of stopping
    not a state on the row: the row
    carries stopRequestedAt, and the
    tools begin answering "answer now"
  end note`;

export const STEER_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person
  participant S as thread.svelte
  participant R as stop-turn.ts
  participant F as flights.ts
  participant T as tools.ts
  participant I as intelligence port

  P->>S: presses Stop
  S->>R: stopTurn(threadId)
  R->>F: mark the flight stopping
  R->>R: write stopRequestedAt on the row
  Note over S: the control becomes Cancel
  I->>T: the next tool call
  T-->>I: "the person asked you to answer now"
  I-->>R: submit_answer, with what it had

  Note over P,I: pressed a second time
  P->>S: presses Cancel
  S->>R: stopTurn(threadId)
  R->>F: abort the flight's controller
  F->>I: the provider request is abandoned
  I-->>R: the run throws
  R->>R: the turn is written cancelled`;

export const RECOVERY_DIAGRAM = `flowchart TB
  subgraph strand["a turn that was interrupted"]
    crash(["the process stops mid-turn"]) --> row["the row still says running"]
    row --> restart["the server starts again"]
    restart --> empty["the flight registry is empty: nothing survives a restart"]
    empty --> reading["a read reports that turn as failed, and writes nothing"]
    empty --> asking{"somebody asks in that chat"}
    asking --> stranded{"is the running turn in the registry?"}
    stranded -->|yes| refuse["refuse: it is still working"]
    stranded -->|no| reclaim["write failed with the reason, then carry on"]
  end

  subgraph disk["every table write"]
    write(["a row changes"]) --> tmp["serialise the whole table to table.json.next"]
    tmp --> keep["rename table.json to table.json.previous"]
    keep --> swap["rename table.json.next to table.json"]
    swap --> safe["the version before this one is still on disk"]
  end`;
