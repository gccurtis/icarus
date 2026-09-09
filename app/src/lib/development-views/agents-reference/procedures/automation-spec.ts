import type { Chain } from "$development-views/agents-reference/types";

export const AUTOMATION_STATE = `erDiagram
  PERSONAS ||--o{ AUTOMATIONS : "gates visibility of"
  AUTOMATIONS ||--o{ AGENTTASKS : "fires, recorded in origin"

  AUTOMATIONS {
    string name "required"
    id personaId "required, reassignable"
    string instruction "may be empty, which forces enabled off"
    AutomationTrigger trigger "one of four kinds"
    ResourceSet scope "optional"
    ToolId-array tools "copied from the persona at creation"
    boolean enabled "true only if it was created with an instruction"
    number firedCount "incremented by Run now"
    number lastFiredAt "optional, set by Run now"
    number revision "compare-and-swap"
  }
  AGENTTASKS {
    TaskOrigin origin "kind automation, the rule id, the trigger kind"
    string title "the rule's name"
    string instruction "the rule's instruction"
  }`;

export const TRIGGER_DIAGRAM = `flowchart TB
  trigger(["AutomationTrigger"]) --> manual["manual"]
  trigger --> schedule["schedule"]
  trigger --> edited["resource-edited"]
  trigger --> created["resource-created"]

  manual --> mp["no parameters"]
  schedule --> sp["at, as HH:MM · repeats: daily, weekdays or weekly · weekday, required only when weekly · timezone"]
  edited --> ep["kinds, at least one · ref, optional: one exact resource instead of the kinds"]
  created --> cp["kinds, at least one"]

  mp --> fires{"what fires it?"}
  sp --> fires
  ep --> fires
  cp --> fires
  fires -->|"only Run now, pressed by a person"| run["runAutomation"]
  fires -->|"a clock"| none1["does not exist"]
  fires -->|"a write hook"| none2["does not exist"]
  run --> stamp["the task it makes is stamped trigger manual, whatever the rule says"]`;

export const RUN_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person
  participant S as a surface
  participant R as index.remote.ts
  participant A as run-automation.ts
  participant T as shared/threads.ts
  participant D as store

  P->>S: presses Run now
  S->>R: runAutomation(automationId)
  R->>A: runAutomation(input)
  A->>A: requireScope, then validateRunAutomation
  A->>D: findVisible automations
  alt not visible
    A-->>S: refused not-found
  else the instruction is blank
    A-->>S: refused invalid-state
  else
    A->>T: openThread with the rule's instruction as the first message
    T->>D: threads, then threadParts part 1
    A->>D: create the task: the rule's name, instruction, persona, scope and tools
    A->>D: firedCount plus one
    A->>D: lastFiredAt
    A->>D: updatedAt
    A-->>R: accepted, the rule id, the new taskId, the unchanged revision
    R->>R: readAgentsLibrary().refresh, readAutomation().refresh
  end
  Note over A,D: enabled is never read. A switched-off rule still runs on demand`;

export const AUTOMATION_CHAINS: readonly Chain[] = [
  {
    name: "createAutomation",
    kind: "command",
    file: "capabilities/agents/api/create-automation/create-automation.ts",
    input: [
      { name: "personaId", type: "string" },
      { name: "name", type: "string", note: "At most 160 characters." },
      { name: "instruction", type: "string, optional", note: "Trimmed. An empty string is dropped entirely, which is what leaves the rule switched off." },
      { name: "trigger", type: "AutomationTrigger, optional", note: "Absent means manual." },
      { name: "scope", type: "ResourceSet, optional" },
      { name: "tools", type: "ToolId[], optional", note: "Absent means a copy of the persona's." }
    ],
    output: [{ name: "accepted", type: "true, with the id and revision 1" }],
    steps: [
      { does: "Establish the scope, then validate.", calls: "requireScope() · validateCreateAutomation" },
      { does: "Find the persona. The only thing that can refuse.", calls: "findVisible(store, scope, \"personas\", personaId)" },
      { does: "Write the rule. enabled is exactly whether an instruction survived validation, so a rule with nothing to say cannot be on.", calls: "store.create(\"automations\", fields)", writes: "automations" }
    ],
    refuses: [{ reason: "not-found", when: "no visible persona has that id" }],
    refreshes: ["readAgentsLibrary()"]
  },
  {
    name: "updateAutomation",
    kind: "command",
    file: "capabilities/agents/api/update-automation/update-automation.ts",
    input: [
      { name: "automationId", type: "string" },
      { name: "baseRevision", type: "number" },
      { name: "patch.name · instruction", type: "string, optional", note: "An empty instruction throws rather than clearing." },
      { name: "patch.personaId", type: "string, optional", note: "Reassigns the rule. Checked against the visible personas." },
      { name: "patch.trigger", type: "AutomationTrigger, optional" },
      { name: "patch.scope", type: "ResourceSet | null, optional", note: "null clears it." },
      { name: "patch.tools", type: "ToolId[], optional" },
      { name: "patch.enabled", type: "boolean, optional" }
    ],
    output: [{ name: "accepted", type: "true, with the new revision" }],
    steps: [
      { does: "Establish the scope and validate. An empty patch throws.", calls: "requireScope() · validateUpdateAutomation" },
      { does: "Find the rule, then compare and swap on the revision.", calls: "findVisible(store, scope, \"automations\", id)" },
      { does: "If the persona is being reassigned, check the new one is visible too." },
      { does: "Refuse switching it on while the effective instruction is blank." },
      { does: "Replace the whole row at revision plus one. firedCount rides through untouched.", calls: "store.update(`automations.${id}`, fields)", writes: "automations" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible automation has that id" },
      { reason: "stale", when: "the revision moved" },
      { reason: "not-found", when: "the patch names a persona that is not visible" },
      { reason: "invalid-state", when: "write the instruction before switching it on" }
    ],
    refreshes: ["readAgentsLibrary()", "readAutomation({ automationId })"]
  },
  {
    name: "runAutomation",
    kind: "command",
    file: "capabilities/agents/api/run-automation/run-automation.ts",
    input: [{ name: "automationId", type: "string", note: "No baseRevision: firing is not a concurrent edit." }],
    output: [
      { name: "accepted", type: "true" },
      { name: "id", type: "string", note: "The automation's id, not the task's." },
      { name: "taskId", type: "string", note: "What it made." },
      { name: "revision", type: "number", note: "The rule's revision, unchanged." }
    ],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateRunAutomation" },
      { does: "Find the rule.", calls: "findVisible(store, scope, \"automations\", id)" },
      { does: "Refuse a rule with nothing to say. enabled is never consulted, so an off rule still runs by hand." },
      { does: "Open a thread with the rule's instruction as its first message.", calls: "openThread(...)", writes: "threads · threadParts" },
      { does: "Create the task from the rule: its name as the title, its instruction, its persona, its scope and its tools. Nothing is read from the persona row.", calls: "store.create(\"agentTasks\", fields)", writes: "agentTasks" },
      { does: "Count the fire, in three separate field writes.", calls: "store.update(`automations.${id}.firedCount`, n + 1) · lastFiredAt · updatedAt", writes: "automations.firedCount · lastFiredAt · updatedAt" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible automation has that id" },
      { reason: "invalid-state", when: "it has no instruction yet, so there is nothing to ask" }
    ],
    refreshes: ["readAgentsLibrary()", "readAutomation({ automationId })"]
  },
  {
    name: "removeAutomation",
    kind: "command",
    file: "capabilities/agents/api/remove-automation/remove-automation.ts",
    input: [
      { name: "automationId", type: "string" },
      { name: "baseRevision", type: "number" }
    ],
    output: [{ name: "accepted", type: "true, with the revision unchanged" }],
    steps: [
      { does: "Establish the scope and validate.", calls: "requireScope() · validateRemoveAutomation" },
      { does: "Find the rule, then compare and swap on the revision.", calls: "findVisible(...)" },
      { does: "Count the visible tasks whose origin names this rule. The count comes from the tasks, not from firedCount." },
      { does: "Refuse if any still do, and say to switch it off instead." },
      { does: "Delete the row.", calls: "store.remove(`automations.${id}`)", writes: "automations" }
    ],
    refuses: [
      { reason: "not-found", when: "no visible automation has that id" },
      { reason: "stale", when: "the revision moved" },
      { reason: "in-use", when: "it fired n tasks that still name it; switch it off instead" }
    ],
    refreshes: ["readAgentsLibrary()", "readAutomation({ automationId })"]
  },
  {
    name: "readAutomation",
    kind: "query",
    file: "capabilities/agents/api/read-automation/read-automation.ts",
    input: [{ name: "automationId", type: "string" }],
    output: [
      { name: "AutomationDetail", type: "AutomationItem plus instruction and fired" },
      { name: "triggerRefName", type: "string | null", note: "Only for an edit trigger bound to one exact resource." },
      { name: "running", type: "number", note: "How many of its tasks are running now." },
      { name: "fired", type: "TaskItem[]", note: "Every task it made, newest first." },
      { name: "null", type: "when it is not visible" }
    ],
    steps: [
      { does: "Establish the scope and validate the id.", calls: "requireScope() · validateReadAutomation" },
      { does: "Find it among the visible rules.", calls: "findVisible(...)" },
      { does: "Project it, resolving the persona's name, the trigger's resource name and the tasks it fired.", calls: "automationDetail(row, visible)" }
    ],
    refuses: [],
    refreshes: []
  }
];
