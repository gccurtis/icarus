export const TOPOLOGY_DIAGRAM = `flowchart LR
  B["merge base<br/>8ba102e"]
  M["main<br/>18 commits"]
  MH["main head<br/>06708d9"]
  D["derived output<br/>41 commits"]
  DH["protected source<br/>7211f1c"]
  R["completed replay<br/>7 stops"]
  P["post-replay head<br/>f003ab5"]
  G["repaired tree<br/>all core gates green"]

  B --> M --> MH
  B --> D --> DH
  MH --> R
  DH --> R
  R --> P --> G
`;

export const CONFLICT_DIAGRAM = `flowchart TB
  S1["01 dependencies"] --> S2["02 atomic creation + semantic enqueue"]
  S2 --> S3["03 New Tab creation extraction"]
  S3 --> S4["04 template semantics + atomicity"]
  S4 --> S5["05 routes + capability inventory + baseline"]
  S5 --> S6["06 overview: seeds + spreadsheet + research"]
  S6 --> S7["07 overview panels + state + runtimes + drafts"]
  S7 --> T["replay complete"]
  T --> A["current-schema adaptation"]
  A --> C["checker ratchet reconciliation"]
`;

export const CHECKER_DIAGRAM = `flowchart LR
  RAW["18 type diagnostics<br/>7 files"]
  SLIDE["slide cutover<br/>14 diagnostics"]
  DOC["document cutover<br/>1 diagnostic"]
  SHEET["spreadsheet template<br/>2 diagnostics"]
  RETURN["literal result type<br/>1 diagnostic"]
  FIX["4 root repairs"]
  TESTS["27 import-blocked suites<br/>become executable"]

  RAW --> SLIDE
  RAW --> DOC
  RAW --> SHEET
  RAW --> RETURN
  SLIDE --> FIX
  DOC --> FIX
  SHEET --> FIX
  RETURN --> FIX
  FIX --> TESTS
`;

export const BASELINE_DIAGRAM = `flowchart LR
  SOURCE["source branch<br/>285 records"]
  MAIN["main<br/>295 records"]
  TRIAL["resulting graph<br/>28 stale records"]
  ATOMIC["document + slide writes<br/>became atomic"]
  CLEAN["resulting tree<br/>257 records"]
  SUITE["90 checks<br/>0 findings"]

  SOURCE --> TRIAL
  MAIN --> TRIAL
  TRIAL -->|"remove only proven stale"| CLEAN
  ATOMIC -.-> TRIAL
  CLEAN --> SUITE
`;

export const DURABILITY_DIAGRAM = `flowchart LR
  UI["document · deck · spreadsheet<br/>project create · template place"]
  TX["one Store transaction"]
  DATA["revision · snapshot<br/>metadata · representation"]
  OUTBOX["semantic job row<br/>exact and/or material"]
  CLAIM["atomic claim<br/>token + 5m lease"]
  WORK["embedding / descriptor provider"]
  PUBLISH["semantic source · object · index"]
  READ["retrieve / retrieve_materials"]

  UI --> TX
  TX --> DATA
  TX --> OUTBOX
  OUTBOX --> CLAIM --> WORK --> PUBLISH --> READ
  WORK -. "throw / process exit" .-> RECOVER["lease expires<br/>bounded retry"]
  RECOVER --> CLAIM
`;

export const FLIGHT_DIAGRAM = `flowchart TB
  ROOT["start.server.ts"] --> MODEL["ServerModel"]
  MODEL --> FLIGHTS["OperationFlights"]
  FLIGHTS --> D["derived output<br/>shared promise + abort"]
  FLIGHTS --> R["research chat<br/>controller + stop + deadline"]
  D --> JOB["durable refresh job"]
  R --> TURN["durable turn row"]
  CLOSE["server.close()"] --> FLIGHTS
  FLIGHTS --> ABORT["abort every active operation"]
  ABORT --> DRAIN["await terminal persistence"]

  note["Capabilities receive the model;<br/>no globalThis registry and no mutable module singleton"]
  note -.-> FLIGHTS
`;

export const RUNBOOK_DIAGRAM = `flowchart LR
  R0["R0 protect"] --> R1["R1 replay"]
  R1 --> R2["R2 creation seams"]
  R2 --> R3["R3 templates + routes"]
  R3 --> R4["R4 overview + workspace"]
  R4 --> R5["R5 representation"]
  R5 --> R6["R6 ratchet + artifact"]
  R6 --> R7["R7 prove"]
  R7 --> READY["review-ready branch"]

  R1 -. unexpected conflict .-> STOP["abort + recertify"]
  R5 -. legacy shim needed .-> STOP
  R7 -. any red gate .-> REPAIR["bounded fix commit"]
  REPAIR --> R7
`;
