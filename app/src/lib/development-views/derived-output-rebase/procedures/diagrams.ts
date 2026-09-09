export const TOPOLOGY_DIAGRAM = `flowchart LR
  B["merge base<br/>8ba102e"]
  M["main<br/>14 commits"]
  MH["main head<br/>3e670c5"]
  D["derived output<br/>39 commits"]
  DH["source head<br/>2c0bcad"]
  R["disposable replay<br/>7 stops"]
  P["planned result<br/>4 root repairs"]
  G["green gate<br/>90 / 90 architecture"]

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
  S5 --> S6["06 overview: spreadsheet + research"]
  S6 --> S7["07 workspace: runtimes + agent drafts"]
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
  MAIN["main<br/>296 records"]
  TRIAL["initial replay<br/>24 stale records"]
  ECHO["2 validity echoes<br/>deleted paths"]
  CLEAN["resulting tree<br/>261 records"]
  SUITE["90 checks<br/>0 findings"]

  SOURCE --> TRIAL
  MAIN --> TRIAL
  TRIAL -->|"remove only proven stale"| CLEAN
  TRIAL -.-> ECHO
  CLEAN --> SUITE
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
