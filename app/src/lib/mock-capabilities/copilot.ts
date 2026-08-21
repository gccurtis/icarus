/**
 * Agent work in flight, the threads it came out of, and what a request can see.
 *
 * `docs/screen-panel-views/inspector/copilot/` is what these serve. The Copilot's
 * home lens reads tasks and conversations, the conversation lens reads one
 * thread, and the scope lens reads the three places a request's scope comes from.
 *
 * The task doors are deliberately not Copilot-specific. The same lens is reached
 * from Project Overview, a persona's Work view and an Automation's last fire, so
 * a task is asked for by id and answers the same way wherever it was named. The
 * four tasks Project Overview lists keep their ids here — `t-1` is the same
 * running task in both — because two panels naming the same work by different
 * ids is a bug a reviewer would chase.
 */
import { RESOURCES, type AgentId, type Resource } from "$mock-capabilities/cast";
import { read, type Read } from "$mock-capabilities/read";

export type TaskState = "waiting" | "running" | "failed" | "completed";

/** Who set it going. A person, an Automation, or another agent — the row resolves through the shared actor lenses. */
export type Dispatcher = {
  readonly kind: "person" | "automation" | "agent";
  readonly name: string;
  /** The id that lens is opened with. Absent where there is nothing to open. */
  readonly id?: string;
};

export type TaskDetail = {
  readonly id: string;
  readonly title: string;
  readonly agent: AgentId;
  readonly state: TaskState;
  /** Running only. The plan's step states carry the same two numbers. */
  readonly progress?: { readonly step: number; readonly of: number };
  /** Failed only, and human-readable: the home lens puts it on the row rather than behind a click. */
  readonly reason?: string;
  /** Completed only. One phrase for what came back, not the produced list. */
  readonly result?: string;
  readonly startedBy: Dispatcher;
  /** Clock time, because *Started* is read against the Automation that fired it. */
  readonly started: string;
  readonly age: string;
  /** Immutable. Changing what was asked means a new task, and the panel says so. */
  readonly prompt: string;
};

/** A task as the home lens lists it: the title, who is doing it, and the one thing its state has to say. */
export type TaskSummary = {
  readonly id: string;
  readonly title: string;
  readonly agent: AgentId;
  readonly state: TaskState;
  readonly detail: string;
  readonly age: string;
};

/** One thread with one agent. The same record serves a home row and the conversation lens. */
export type Conversation = {
  readonly id: string;
  readonly title: string;
  readonly agent: AgentId;
  readonly turns: number;
  readonly started: string;
  readonly lastActive: string;
};

export type LatestMessage = {
  readonly id: string;
  readonly body: string;
  readonly author: string;
  /** Half a thread's turns are the person's, so the last one is not always the agent's. */
  readonly authorKind: "agent" | "person";
  readonly at: string;
};

/** The progress bar, spelled out. */
export type PlanStep = {
  readonly id: string;
  readonly title: string;
  readonly state: "done" | "active" | "pending";
  /** What the step came back with, where it has something to say. */
  readonly detail?: string;
};

export type TaskToolCall = {
  readonly id: string;
  readonly name: string;
  /** Same three outcomes the research trace uses: finding nothing is an outcome, not an error. */
  readonly outcome: "Success" | "Nothing found" | "Failed";
  readonly duration: string;
  readonly result?: string;
};

/**
 * What came out of a task. Not a resource: nothing in the project can retrieve it
 * until it is promoted, which is why the target kind is on the row and the
 * promotion is the row's action.
 */
export type TaskOutput = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly promotesTo: "Finding" | "Document" | "Slide deck" | "Spreadsheet";
  /** The resource it became, once someone promoted it. */
  readonly promotedAs?: string;
};

/**
 * What the screen you are on can offer. Nothing here is attached — the door
 * offers, the request's draft state decides — so there is no attached flag to
 * read as one.
 */
export type Suggestion = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
};

export type SavedScope = {
  readonly id: string;
  readonly name: string;
  /** Resolved now, not stored. A Context is a rule, and the rule matches a different number every week. */
  readonly resolves: number;
  /** A zero-member Context broadens retrieval to the whole project, so it is offered blocked rather than not offered. */
  readonly blocked: boolean;
  readonly reason?: string;
};

export type PersonaScope = {
  readonly agent: string;
  readonly name: string;
  readonly resources: number;
  /** Rendered as fixed, never as an unchecked option: switching it off means editing the Persona. */
  readonly fixed: true;
};

export type ScopeTotal = {
  readonly resources: number;
  /** Applied after the union rather than as a term in it, which is why it is a flag and not a part. */
  readonly membershipEnforced: true;
};

/** In display order, newest first inside each state, so a filtered list needs no second sort. */
const TASKS: readonly TaskDetail[] = [
  {
    id: "t-1",
    title: "Summarise overnight outage reports",
    agent: "grid-analyst",
    state: "running",
    progress: { step: 3, of: 5 },
    startedBy: { kind: "automation", name: "Nightly filing digest", id: "au-digest" },
    started: "02:00",
    age: "12m",
    prompt:
      "Summarise last night's outage reports by substation and flag anything that changes the filing position."
  },
  {
    id: "t-8",
    title: "Recheck the citations in section 4",
    agent: "source-checker",
    state: "running",
    progress: { step: 1, of: 3 },
    startedBy: { kind: "person", name: "Ana Reyes", id: "ana" },
    started: "09:41",
    age: "34m",
    prompt:
      "Check every figure in section 4 of the Regulatory Filing Draft against the source it cites. Section 4 only."
  },
  {
    id: "t-5",
    title: "Confirm filing deadline",
    agent: "filing-editor",
    state: "waiting",
    startedBy: { kind: "person", name: "Tomas Kaur", id: "tomas" },
    started: "09:35",
    age: "40m",
    prompt:
      "Set filingDeadline from the commission's docket and tell me if it has moved from 14 Nov 2026."
  },
  {
    id: "t-2",
    title: "Draft the reliability section",
    agent: "filing-editor",
    state: "waiting",
    startedBy: { kind: "person", name: "Mira Jain", id: "mira" },
    started: "08:10",
    age: "2h",
    prompt:
      "Draft the reliability section from the accepted findings. Every figure carries the source it came from."
  },
  {
    id: "t-9",
    title: "Approve the 41-substation sample",
    agent: "grid-analyst",
    state: "waiting",
    startedBy: { kind: "person", name: "Mira Jain", id: "mira" },
    started: "05:20",
    age: "5h",
    prompt:
      "Sample the substation inventory for the hardening cost roll-up and show me the sample before you cost it."
  },
  {
    id: "t-6",
    title: "Rebuild substation crosswalk",
    agent: "grid-analyst",
    state: "failed",
    reason: "Tool not permitted — table.write",
    startedBy: { kind: "person", name: "Mira Jain", id: "mira" },
    started: "07:12",
    age: "3h",
    prompt:
      "Rebuild the crosswalk between Substation Inventory and outageEvents, keyed on the feeder id."
  },
  {
    id: "t-3",
    title: "Check citations in the filing draft",
    agent: "source-checker",
    state: "failed",
    reason: "The connector could not be read",
    startedBy: { kind: "person", name: "Ana Reyes", id: "ana" },
    started: "16:04",
    age: "1d",
    prompt:
      "Check every citation in the Regulatory Filing Draft against the source it names, and list the ones that do not carry the claim."
  },
  {
    id: "t-7",
    title: "Extract 2024 storm precedents",
    agent: "grid-analyst",
    state: "completed",
    result: "22 precedents",
    startedBy: { kind: "person", name: "Ana Reyes", id: "ana" },
    started: "08:02",
    age: "2h",
    prompt:
      "Extract every storm-hardening precedent granted since 2019, with docket number and the amount allowed."
  },
  {
    id: "t-10",
    title: "Draft the outage-cost appendix",
    agent: "filing-editor",
    state: "completed",
    result: "4 pages",
    startedBy: { kind: "agent", name: "Grid Analyst", id: "grid-analyst" },
    started: "14:35",
    age: "Yesterday",
    prompt:
      "Write the outage-cost appendix from the Outage Cost Model, one table per substation group."
  },
  {
    id: "t-4",
    title: "Cluster the winter-storm findings",
    agent: "grid-analyst",
    state: "completed",
    result: "18 findings clustered",
    startedBy: { kind: "person", name: "Mira Jain", id: "mira" },
    started: "10:18",
    age: "2d",
    prompt: "Cluster the accepted winter-storm findings by cause and name each cluster."
  }
];

/**
 * The one line a state gets on a home row. Derived rather than stored, so the
 * row and the lens above it cannot come to disagree about what a task is doing.
 */
const stateLine = (task: TaskDetail): string =>
  task.progress !== undefined
    ? `Step ${task.progress.step} of ${task.progress.of}`
    : task.state === "failed"
      ? (task.reason ?? "Failed")
      : task.state === "completed"
        ? (task.result ?? "Done")
        : "Waiting";

const CONVERSATIONS: readonly Conversation[] = [
  {
    id: "ch-1",
    title: "Relay coordination history",
    agent: "grid-analyst",
    turns: 14,
    started: "Today, 11:04",
    lastActive: "2h"
  },
  {
    id: "ch-2",
    title: "Where undergrounding paid for itself",
    agent: "grid-analyst",
    turns: 6,
    started: "Yesterday, 09:30",
    lastActive: "Yesterday"
  },
  {
    id: "ch-3",
    title: "Wording for the reliability section",
    agent: "filing-editor",
    turns: 9,
    started: "17 Aug, 14:20",
    lastActive: "3d"
  },
  {
    id: "ch-4",
    title: "Which claims have no cited source",
    agent: "source-checker",
    turns: 4,
    started: "15 Aug, 10:05",
    lastActive: "5d"
  }
];

const LATEST: Record<string, LatestMessage> = {
  "ch-1": {
    id: "m-1",
    body: "The filings index lists a 2019 study and no successor. Two sources.",
    author: "Grid Analyst",
    authorKind: "agent",
    at: "14:02"
  },
  "ch-2": {
    id: "m-2",
    body: "Undergrounding cut SAIDI 38% on the three feeders that have it. The other nine have no comparable year.",
    author: "Grid Analyst",
    authorKind: "agent",
    at: "16:41"
  },
  "ch-3": {
    id: "m-3",
    body: "Rewritten to lead with the 4,182 recorded events rather than the 46,000,000.",
    author: "Filing Editor",
    authorKind: "agent",
    at: "11:18"
  },
  "ch-4": {
    id: "m-4",
    body: "Section 4 only, then — leave the appendix until the cost model settles.",
    author: "Ana Reyes",
    authorKind: "person",
    at: "09:52"
  }
};

const PLANS: Record<string, readonly PlanStep[]> = {
  "t-1": [
    { id: "s-1", title: "Resolve what it can look up", state: "done" },
    { id: "s-2", title: "Read overnight reports", state: "done", detail: "14 sources" },
    { id: "s-3", title: "Group by substation", state: "active" },
    { id: "s-4", title: "Flag filing-relevant changes", state: "pending" },
    { id: "s-5", title: "Write the summary", state: "pending" }
  ],
  "t-3": [
    { id: "s-6", title: "List every citation in the draft", state: "done", detail: "61 citations" },
    { id: "s-7", title: "Open each cited source", state: "active", detail: "Stopped at 12 of 61" },
    { id: "s-8", title: "Report the claims a source does not carry", state: "pending" }
  ],
  "t-5": [
    { id: "s-9", title: "Read the commission's docket", state: "done", detail: "2 filings" },
    { id: "s-10", title: "Compare against filingDeadline", state: "done", detail: "14 Nov 2026 unchanged" },
    { id: "s-11", title: "Confirm before writing the variable", state: "active" }
  ],
  "t-4": [
    { id: "s-12", title: "Read the accepted findings", state: "done", detail: "18 findings" },
    { id: "s-13", title: "Cluster by cause", state: "done", detail: "5 clusters" },
    { id: "s-14", title: "Name each cluster", state: "done" }
  ]
};

const TOOLS: Record<string, readonly TaskToolCall[]> = {
  "t-1": [
    {
      id: "tc-1",
      name: "lattice.retrieve",
      outcome: "Success",
      duration: "1.4 s",
      result: "14 regions"
    },
    { id: "tc-2", name: "resource.read", outcome: "Success", duration: "0.3 s" },
    {
      id: "tc-3",
      name: "table.query",
      outcome: "Success",
      duration: "0.9 s",
      result: "4,182 rows scanned, 318 matched"
    },
    {
      id: "tc-4",
      name: "lattice.retrieve",
      outcome: "Nothing found",
      duration: "0.7 s",
      result: "Feeder 12, 19 Feb"
    }
  ],
  "t-3": [
    { id: "tc-5", name: "resource.read", outcome: "Success", duration: "0.4 s", result: "61 citations" },
    {
      id: "tc-6",
      name: "connector.fetch",
      outcome: "Failed",
      duration: "8.0 s",
      result: "SharePoint — Ops Reports: authentication expired"
    }
  ],
  "t-6": [
    {
      id: "tc-7",
      name: "table.write",
      outcome: "Failed",
      duration: "0.1 s",
      result: "Not in this persona's allowance"
    }
  ],
  "t-4": [
    { id: "tc-8", name: "finding.list", outcome: "Success", duration: "0.2 s", result: "18 findings" },
    { id: "tc-9", name: "lattice.cluster", outcome: "Success", duration: "3.1 s", result: "5 clusters" }
  ]
};

const PRODUCED: Record<string, readonly TaskOutput[]> = {
  "t-7": [
    {
      id: "po-1",
      title: "22 storm-hardening precedents, 2019–2024",
      summary: "Docket number, party and amount allowed for each. Two are still under appeal.",
      promotesTo: "Document"
    }
  ],
  "t-4": [
    {
      id: "po-2",
      title: "Five clusters over 18 findings",
      summary: "Relay coordination, undergrounding, vegetation, substation flooding, load transfer.",
      promotesTo: "Finding"
    }
  ],
  "t-10": [
    {
      id: "po-3",
      title: "Outage-cost appendix, 4 pages",
      summary: "One table per substation group, footed to the 46,000,000 hardening budget.",
      promotesTo: "Document",
      promotedAs: "Regulatory Filing Draft"
    }
  ]
};

/**
 * What each screen offers a request. Keyed by screen because the screen supplies
 * it — the Copilot does not guess what is selectable on a surface it did not draw.
 */
const SUGGESTED: Record<string, readonly Suggestion[]> = {
  document: [
    { id: "sg-1", label: "This selection", detail: "38 characters" },
    { id: "sg-2", label: "Q3 Resilience Memo", detail: "the document you are in" }
  ],
  spreadsheet: [
    { id: "sg-3", label: "C2:C40", detail: "39 cells" },
    { id: "sg-4", label: "Outage Cost Model", detail: "the spreadsheet you are in" }
  ],
  "project-overview": [
    { id: "sg-5", label: "4 selected resources", detail: "the rows ticked in the table" },
    { id: "sg-6", label: "Northwind Grid Resilience", detail: "the project you are in" }
  ]
};

const SAVED_SCOPES: readonly SavedScope[] = [
  { id: "sx-field", name: "Field reports 2024–25", resolves: 96, blocked: false },
  { id: "sx-reg", name: "Regulatory corpus", resolves: 34, blocked: false },
  { id: "sx-evidence", name: "Filing evidence", resolves: 24, blocked: false },
  {
    id: "sx-precedents",
    name: "Storm precedents",
    resolves: 0,
    blocked: true,
    reason: "matches nothing"
  }
];

const PERSONA_SCOPES: Record<AgentId, PersonaScope> = {
  "grid-analyst": {
    agent: "Grid Analyst",
    name: "Field reports 2024–25",
    resources: 96,
    fixed: true
  },
  "filing-editor": {
    agent: "Filing Editor",
    name: "Regulatory corpus",
    resources: 34,
    fixed: true
  },
  "source-checker": {
    agent: "Source Checker",
    name: "Everything the filing cites",
    resources: 61,
    fixed: true
  }
};

/** One state's worth of the home lens. Called once per section, in the section's own order. */
export const tasksIn = (projectId: string, state: TaskState): Read<readonly TaskSummary[]> => {
  void projectId;
  return read(
    TASKS.filter((task: TaskDetail) => task.state === state).map((task: TaskDetail) => ({
      id: task.id,
      title: task.title,
      agent: task.agent,
      state: task.state,
      detail: stateLine(task),
      age: task.age
    }))
  );
};

/** Threads with agents, most recent first. */
export const conversationsIn = (projectId: string): Read<readonly Conversation[]> => {
  void projectId;
  return read(CONVERSATIONS);
};

export const conversation = (chatId: string): Read<Conversation> =>
  read(CONVERSATIONS.find((candidate: Conversation) => candidate.id === chatId) ?? CONVERSATIONS[0]);

/** The last thing said, which is how you tell whether this is the thread you meant. */
export const latestMessage = (chatId: string): Read<LatestMessage> =>
  read(LATEST[chatId] ?? LATEST["ch-1"]);

export const task = (taskId: string): Read<TaskDetail> =>
  read(TASKS.find((candidate: TaskDetail) => candidate.id === taskId) ?? TASKS[0]);

export const planFor = (taskId: string): Read<readonly PlanStep[]> =>
  read(PLANS[taskId] ?? PLANS["t-1"]);

export const toolsUsedIn = (taskId: string): Read<readonly TaskToolCall[]> =>
  read(TOOLS[taskId] ?? []);

/** Empty until there is something to promote, which is the normal state of a running task. */
export const producedBy = (taskId: string): Read<readonly TaskOutput[]> =>
  read(PRODUCED[taskId] ?? []);

export const suggestedScope = (screenId: string): Read<readonly Suggestion[]> =>
  read(SUGGESTED[screenId] ?? SUGGESTED.document);

export const savedScopes = (projectId: string): Read<readonly SavedScope[]> => {
  void projectId;
  return read(SAVED_SCOPES);
};

/** What the persona always has. Not switchable, and the shape says so rather than the panel. */
export const personaScope = (agentId: AgentId): Read<PersonaScope> => read(PERSONA_SCOPES[agentId]);

/**
 * The union, with membership applied after it. With nothing picked the total is
 * the persona's own scope, which is why it is read off that rather than stored.
 */
export const scopeTotal = (agentId: AgentId): Read<ScopeTotal> =>
  read({ resources: PERSONA_SCOPES[agentId].resources, membershipEnforced: true });

/** What the scope panel's search runs over: a one-off resource for this request, saving no Context. */
export const attachableIn = (projectId: string): Read<readonly Resource[]> => {
  void projectId;
  return read(RESOURCES);
};
