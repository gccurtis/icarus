import type {
  AuditFinding,
  AuditMetric,
  FindingGroup,
  ScorecardRow,
  StateOwnerRow,
  Strength
} from "$development-views/state-behavior-audit/types";

export const AUDIT_META = {
  date: "9 September 2026",
  revision: "306e308",
  branch: "main",
  scope:
    "Production app views, authored components, surfaces, client and server models, capabilities, representation, runtimes, routes, and architecture enforcement. Demo-only I/O is called out separately."
} as const;

export const VERDICT = {
  headline: "Subject boundaries are enforced; client ownership work remains.",
  summary:
    "Representation is pure, construction is centralized, capabilities are stateless, and production server access crosses through a model. Browser reads and writes now use subject capabilities with scoped current-schema admission; the generic Store compatibility surface has been removed. Remaining debt is concentrated in view behavior and resource-runtime lifetime.",
  answer:
    "The authority boundary now matches the target architecture. The largest remaining gap is the view layer, followed by resource-runtime lifecycle and multi-record intents that have not yet adopted the transaction boundary."
} as const;

export const METRICS: readonly AuditMetric[] = [
  {
    value: "90 / 90",
    label: "Architecture checks clean",
    detail: "All checks execute; 327 pre-existing findings are held by the reviewed debt ratchet.",
    tone: "positive"
  },
  {
    value: "177",
    label: "First-party production Svelte files",
    detail: "App views, surfaces, and authored components; vendored and development views excluded."
  },
  {
    value: "84",
    label: "Components declaring local $state",
    detail: "240 state-bearing lines across the audited production view trees.",
    tone: "attention"
  },
  {
    value: "106",
    label: "Inline lifecycle/effect sites",
    detail: "$effect, onMount, and onDestroy occurrences inside production .svelte files.",
    tone: "attention"
  },
  {
    value: "7",
    label: "Component scripts over 400 lines",
    detail: "The script alone is larger than a reviewable component boundary.",
    tone: "danger"
  },
  {
    value: "45",
    label: "View-triggered runtime attachments",
    detail: "16 document and 28 presentation view files call an accessor that mutates runtime lifetime.",
    tone: "danger"
  }
];

export const SCORECARD: readonly ScorecardRow[] = [
  {
    concern: "Representation purity",
    grade: "Strong",
    assessment: "Types and deterministic behavior are isolated from process, client, and server concerns.",
    evidence: "Six representation checks pass; no representation import reaches another architectural tree."
  },
  {
    concern: "Composition roots",
    grade: "Strong",
    assessment: "Client and server graphs are built at explicit roots with one environment-owned holder.",
    evidence: "runtime/client/start.ts and runtime/server/start.server.ts; all eight runtime checks pass."
  },
  {
    concern: "Server state ownership",
    grade: "Strong",
    assessment: "Configuration, observability, and represented storage have explicit process lifetimes.",
    evidence: "Production file and logger I/O stays inside server models; request identity remains request-scoped."
  },
  {
    concern: "Capability authority",
    grade: "Strong",
    assessment: "Browser operations cross named subject capabilities with scope, exact input admission, and ownership checks.",
    evidence: "The generic Store capability is absent; comment reads and writes are scoped by the Comments capability."
  },
  {
    concern: "Workspace ownership",
    grade: "Strong",
    assessment: "Tabs, panel geometry, inspection, zoom, and resource runtimes have one coordinator without a generic table-query API.",
    evidence: "WorkspaceState exposes no persistence table vocabulary; views read closed subject projections."
  },
  {
    concern: "Resource edit state",
    grade: "Partial",
    assessment: "Document and presentation runtimes own buffers and history, but their lifetime is render-driven; the spreadsheet runtime is disconnected.",
    evidence: "Runtime attach is idempotent but never balanced on tab close; SpreadsheetRuntimes has no production consumer."
  },
  {
    concern: "Component behavior separation",
    grade: "Weak",
    assessment: "Procedure directories exist, yet the most complex components still contain controllers, effects, DOM adapters, and command chains.",
    evidence: "Seven component script blocks exceed 400 lines; document.svelte contains eleven lifecycle effects."
  },
  {
    concern: "Local-state classification",
    grade: "Weak",
    assessment: "Ephemeral interaction state and tab/resource-correlated state are not consistently distinguished.",
    evidence: "Spreadsheet zoom/selection, analysis edits, research decisions, and agent task output live in remounted components."
  },
  {
    concern: "Procedure granularity",
    grade: "Weak",
    assessment: "Several extracted procedure files became category-scale repositories rather than small, named call chains.",
    evidence: "1,687-line template validation, 1,535-line agents procedure, and 1,017-line New-tab library."
  },
  {
    concern: "External I/O boundary",
    grade: "Partial",
    assessment: "Server persistence and network I/O are model-owned, but one production surface still reaches browser storage directly.",
    evidence: "top-bar/effects/apply-appearance.svelte.ts uses localStorage outside the client storage owner."
  },
  {
    concern: "Enforcement and reviewability",
    grade: "Strong",
    assessment: "Every pillar contract maps to an executable checker, and every checker has a mutation proving that it can fail.",
    evidence: "90 checks cover 45 pillar contracts; 327 existing findings are explicit debt and every new finding blocks lint."
  }
];

export const STRENGTHS: readonly Strength[] = [
  {
    title: "The dependency graph is legible",
    description:
      "Representation, model, runtime, capability, surface, view, and component trees have explicit import rules. A browser-to-server edge can only terminate at a capability index.",
    evidence: "across/one-crossing + client-server-separation"
  },
  {
    title: "The server follows the intended state/procedure split",
    description:
      "Capabilities hold no request-to-request state, resolve scope first, validate input, and reach persistence through ServerModel. Initialization and request scope are distinct entry points.",
    evidence: "10 capability checks + runtime/server"
  },
  {
    title: "Workspace operations have one writer",
    description:
      "TabList and TabViews are private collaborators. Public workspace gestures become operations and are applied through WorkspaceState instead of an event bus or surface-to-surface calls.",
    evidence: "model/client/workspace-state/methods"
  },
  {
    title: "Resource buffers have a real owner",
    description:
      "Document and presentation runtimes correctly own optimistic bodies, unsent operations, revision state, history, coalescing, and synchronization.",
    evidence: "model/client/{document,presentation}-runtimes"
  },
  {
    title: "Authored components are context-free",
    description:
      "Reusable authored components take props and callbacks and cannot import capabilities, models, runtime, or representation. That boundary is enforced.",
    evidence: "components/component-takes-only-props"
  },
  {
    title: "Small models are not broadly proliferating",
    description:
      "There are nine client objects and three server objects. TabList and TabViews are small but hidden and invariant-bearing; the one unjustified object today is unused Storage.",
    evidence: "runtime/client/types.ts + runtime/server/types.ts"
  }
];

export const STATE_OWNERS: readonly StateOwnerRow[] = [
  {
    state: "Process configuration, logger, represented tables",
    intendedOwner: "Server model",
    asBuilt: "Configuration, Observability, and Store are constructed once and reached through ServerModel.",
    grade: "Strong"
  },
  {
    state: "Request identity and project authority",
    intendedOwner: "Request scope, not a model",
    asBuilt: "Session is resolved per request; requireScope combines it with the active project token.",
    grade: "Strong"
  },
  {
    state: "Tabs, focus, panel geometry, inspector selection, zoom",
    intendedOwner: "WorkspaceState / per-tab view state",
    asBuilt: "Mostly centralized, operation-backed, and keyed by tab.",
    grade: "Strong"
  },
  {
    state: "Document and presentation body, revision, buffer, history",
    intendedOwner: "One resource runtime per resource",
    asBuilt: "Correct data owner; incorrect acquire/release owner and too many render-time access sites.",
    grade: "Partial"
  },
  {
    state: "Spreadsheet body and edit history",
    intendedOwner: "Spreadsheet runtime",
    asBuilt: "A runtime is constructed but unreachable; the live component renders canned constants.",
    grade: "Critical"
  },
  {
    state: "Project data queries",
    intendedOwner: "Typed subject read model or coherent project-data registry",
    asBuilt: "WorkspaceState pre-constructs generic queries for all 42 representation tables.",
    grade: "Weak"
  },
  {
    state: "Per-tab editor controls and working definitions",
    intendedOwner: "Workspace-owned tab state or the resource runtime, according to meaning",
    asBuilt: "Spreadsheet, analysis, research, and agent state lives in components that remount on tab changes.",
    grade: "Weak"
  },
  {
    state: "DOM refs, hover, pointer gestures, unsaved field drafts",
    intendedOwner: "Component-instance state object",
    asBuilt: "Usually local, which is correct, but frequently mixed with the behavior chain in the .svelte file.",
    grade: "Partial"
  },
  {
    state: "Appearance preference",
    intendedOwner: "Client preferences/configuration model using the client storage boundary",
    asBuilt: "Module-global $state reads and writes localStorage directly from a surface effect.",
    grade: "Weak"
  },
  {
    state: "Agents, research, analysis, spreadsheet prototype records",
    intendedOwner: "Represented server state reached through subject capabilities",
    asBuilt: "Production view modules and components act as immutable mock repositories.",
    grade: "Critical"
  }
];

const FINDINGS: readonly AuditFinding[] = [
  {
    id: "ARCH-02",
    priority: "P1",
    area: "Authority and persistence",
    title: "Multi-table capabilities do not use the atomic Store boundary",
    finding:
      "StoreModel exposes a staged transaction with a durable commit journal and constructor-time recovery. Some multi-record capabilities still create resource + leader snapshot or change set + snapshot + resource metadata as separate commits instead of using it; comment thread creation has moved to the transaction boundary.",
    consequence:
      "A later persistence failure can leave a resource without its snapshot or revision history that disagrees with the leader. The persistence model can uphold all-or-nothing semantics, but those remaining capabilities have not yet placed their intent inside that boundary.",
    recommendation:
      "Move each multi-write capability into StoreModel.transaction, use only the callback-scoped unit, and add its path to the failpoint contract. Keep recovery in the persistence model; do not add capability-level best-effort rollback.",
    acceptance:
      "Fault injection at every write point proves each capability lands all of its rows or none, including after process restart.",
    evidence: [
      "model/server/store/store.md",
      "project-resources/api/create-project-resource.ts:102",
      "document/api/submit-document-changes.ts:133",
      "presentation/api/submit-presentation-changes.ts:57"
    ]
  },
  {
    id: "ARCH-03",
    priority: "P1",
    area: "Client state ownership",
    title: "Resource runtime lifetime is driven by rendering, not by workspace tabs",
    finding:
      "WorkspaceState.documentRuntime() and presentationRuntime() are named as accessors but call attach(). Forty-four view files invoke them, usually from effects. Closing a tab records a workspace operation but never releases its runtime; only ClientModel.close() releases all runtimes.",
    consequence:
      "Closed resources remain subscribed and retained for the whole browser session. Mounting inspectors and context views also becomes a hidden lifecycle operation and can trigger redundant synchronization reads.",
    recommendation:
      "Let WorkspaceState acquire exactly once when a resource tab opens or restores, release when the last referencing tab closes, and expose a read-only runtimeFor accessor to views. Keep attachment out of render effects.",
    acceptance:
      "Runtime open ids exactly follow referenced tabs, closing the last tab releases the subscription and flushes once, and mounting any view performs no attach or sync side effect.",
    evidence: [
      "workspace-state/methods/document-runtime.ts:4",
      "workspace-state/methods/presentation-runtime.ts:4",
      "workspace-state/methods/close.ts:6",
      "document-runtimes/methods/attach.ts:4",
      "app-views: 44 runtime accessor call sites"
    ]
  },
  {
    id: "ARCH-04",
    priority: "P1",
    area: "Client state ownership",
    title: "SpreadsheetRuntime exists in the graph but has no route to the spreadsheet editor",
    finding:
      "ClientModel constructs and returns SpreadsheetRuntimes, but WorkspaceState receives only the document and presentation registers. No production view consumes SpreadsheetRuntime. sheet.svelte instead owns a canned sheet, local selection, and local zoom.",
    consequence:
      "The declared state owner is dead while the component is the effective owner. Resource ids do not determine rendered content, edits cannot persist, and tab-correlated state resets on remount.",
    recommendation:
      "Complete the subject vertically: typed spreadsheet read/write capability, runtime synchronization, workspace-owned lifetime/access, and a surface adapter that renders runtime.body. Move cell selection and zoom into per-tab workspace state.",
    acceptance:
      "Opening two spreadsheet ids renders their distinct represented bodies; edits survive tab switches and reload; runtime lifetime is balanced; no canned Cell repository remains in production.",
    evidence: [
      "runtime/client/start.ts:46",
      "workspace-state/constructor.ts",
      "spreadsheet-runtimes/methods/attach.ts:24",
      "spreadsheet-editor/content/sheet.svelte:69",
      "spreadsheet-editor/content/sheet.svelte:487"
    ]
  },
  {
    id: "ARCH-05",
    priority: "P1",
    area: "Views and procedures",
    title: "The largest components are still controllers",
    finding:
      "Procedure extraction is substantial, but document.svelte, presentation.svelte, slide-surface.svelte, chart.svelte, sheet.svelte, research/thread.svelte, and templates/inspector/template.svelte each retain more than 400 script lines. They coordinate state, lifecycle, DOM/library adapters, validation, async commands, and event interpretation beside markup.",
    consequence:
      "A reviewer cannot inspect rendering without also understanding the full behavior graph. Effects are anonymous, state transitions are difficult to unit test, and a small visual change enters a high-conflict file.",
    recommendation:
      "Give each complex component a colocated instance-state object and named procedure tree. Keep only props, derived presentation values, controller construction, and markup bindings in .svelte; place each effect in procedures/effects and each event chain behind a named command.",
    acceptance:
      "Every long component has a short declarative script, each effect has a named module and focused test, and no component owns a multi-step capability or persistence command.",
    evidence: [
      "document-editor/content/document.svelte: 472 script lines / 11 effects",
      "presentation-editor/content/presentation.svelte: 519 script lines",
      "components/authored/slide-surface/slide-surface.svelte: 470 script lines",
      "templates/inspector/template.svelte: 493 script lines",
      "research/content/thread.svelte: 865 script lines"
    ]
  },
  {
    id: "ARCH-06",
    priority: "P1",
    area: "Client state ownership",
    title: "Some tab- and resource-correlated state is classified as component-local",
    finding:
      "The content surface deliberately keys the centre by active tab, so switching tabs destroys and recreates the component. Spreadsheet selection/zoom, analysis definition edits, research decisions/composer choices, agent task output, and automation enabled state nevertheless live in those components.",
    consequence:
      "State that conceptually belongs to a tab or resource disappears on an ordinary tab switch, while two views of the same resource can disagree. This is exactly the correlation WorkspaceState and resource runtimes are intended to provide.",
    recommendation:
      "Apply an explicit placement rule: DOM refs, hover, drag drafts, and unsubmitted field text stay in a component-instance controller; tab navigation/display state belongs to WorkspaceState; unsaved resource edits belong to the resource runtime; durable domain state belongs behind a capability.",
    acceptance:
      "Tab switches preserve all user-visible editor state that should survive, separate tabs remain independent, and local component state contains only interaction-lifetime values.",
    evidence: [
      "surfaces/content/content.svelte:64",
      "spreadsheet-editor/content/sheet.svelte:487",
      "analysis/content/chart.svelte:168",
      "research/content/thread.svelte:830",
      "agents/content/task.svelte:75"
    ]
  },
  {
    id: "ARCH-07",
    priority: "P1",
    area: "Client state ownership",
    title: "Production view modules still act as mock repositories",
    finding:
      "Agents, research, analysis, spreadsheet, and parts of New tab expose hand-written records through local Read<T> facades. These are not development fixtures: they are imported by production app views and include invented resource identities.",
    consequence:
      "The visible application has multiple sources of truth. It can render data no server owns, and component behavior may appear complete while no capability, runtime, or persistence path exists beneath it.",
    recommendation:
      "Delete production mocks as each subject is wired. Put visual fixtures under development-views or tests only. If a subject is not implemented, render an explicit unavailable state rather than a realistic fake editor.",
    acceptance:
      "No production app-view defines a fake Read<T>, canned resource repository, or invented persistent id; every live record is a typed capability projection or runtime body.",
    evidence: [
      "agents/procedures/agents.ts:1",
      "research/content/thread.svelte:136",
      "analysis/procedures/analysis.ts:1",
      "spreadsheet-editor/content/sheet.svelte:62",
      "new-tab/procedures/library.ts:953"
    ]
  },
  {
    id: "ARCH-09",
    priority: "P2",
    area: "Views and procedures",
    title: "Eight components cross directly to capabilities",
    finding:
      "Most remote calls are already behind view procedures, but eight .svelte files import a capability index directly. The direct callers mix loading resources, command state, error handling, refresh ordering, and presentation state in the component.",
    consequence:
      "The visible component is no longer a declarative call site, and the same remote behavior is harder to reuse or test without rendering. Comment commands are duplicated across document, presentation, and general inspectors.",
    recommendation:
      "Make direct capability imports illegal in production .svelte files. Put query construction and command chains in the component's procedure tree; keep editor-specific presentation independent while giving each copy the same typed subject-capability contract.",
    acceptance:
      "Zero production .svelte files import $capabilities; capability commands have procedure-level tests; duplicated comment panels no longer implement persistence themselves.",
    evidence: [
      "document-editor/inspector/comment.svelte",
      "document-editor/inspector/text-selection.svelte",
      "new-tab/content/launcher.svelte",
      "project-overview/content/overview.svelte",
      "presentation-editor/context/comments.svelte",
      "presentation-editor/inspector/comment.svelte",
      "presentation-editor/inspector/threads.svelte",
      "app-views/general/comment/comment.svelte"
    ]
  },
  {
    id: "ARCH-10",
    priority: "P2",
    area: "Models and runtimes",
    title: "Runtime definitions do not consistently stop at state and a thin public surface",
    finding:
      "Commands, Configuration, Store, and much of WorkspaceState delegate cleanly to methods/. The three resource Runtime classes still implement scheduling, retry/revert entry behavior, timer management, and settling inline.",
    consequence:
      "The file named definition is sometimes the state ledger and sometimes the procedure implementation. A reviewer cannot reliably infer where behavior lives from the tree.",
    recommendation:
      "Keep definitions to owned fields, derived accessors, construction, and one-line public delegation. Move scheduling, settlement, CRUD admission/commit, and other chains to methods/. Keep the three editor runtimes independent but structurally parallel; do not force a generic superclass merely to remove repetition.",
    acceptance:
      "An AST rule can identify every nontrivial model method body as a delegation, and all timers, remote calls, persistence calls, and multi-step branches live under methods/.",
    evidence: [
      "document-runtimes/definition.svelte.ts:61",
      "presentation-runtimes/definition.svelte.ts:58",
      "spreadsheet-runtimes/definition.svelte.ts:54"
    ]
  },
  {
    id: "ARCH-11",
    priority: "P2",
    area: "Models and runtimes",
    title: "Two mutable module globals bypass the client graph",
    finding:
      "Appearance is held in module-level $state and writes localStorage directly from a surface effect. The general comment helper maintains a module-level id counter.",
    consequence:
      "The client graph is not the complete inventory of client-lifetime state, test instances can leak through module state, and the one model intended to own browser persistence has no actual responsibility.",
    recommendation:
      "Put appearance in a client preferences model and make transient id generation stateless or instance-owned. Permit mutable module state only for the explicit runtime graph holder and one-per-process server infrastructure.",
    acceptance:
      "Searching production modules finds no mutable module binding outside approved composition roots or factory closures, and every constructed client model has at least one production consumer.",
    evidence: [
      "top-bar/effects/apply-appearance.svelte.ts:25",
      "app-views/general/comment/threads.ts:79"
    ]
  },
  {
    id: "ARCH-12",
    priority: "P2",
    area: "Views and procedures",
    title: "Several procedure files are repositories rather than procedure chains",
    finding:
      "Extraction has sometimes moved complexity without segmenting it. agents.ts combines types, fixtures, persona queries, automations, tasks, and conversations; New-tab library spans templates, connectors, drafts, analyses, and recents; template validation handles three editor body schemas in one file.",
    consequence:
      "The procedure directory exists, but a change still enters a file with dozens of exports and unrelated reasons to change. Location no longer communicates responsibility.",
    recommendation:
      "Split by named entry procedure and its supporting call tree. Keep shared/ only for steps used by multiple entries. Move fixture data out of production. Introduce complexity review thresholds based on script lines, exported symbols, and responsibility count—not line count alone.",
    acceptance:
      "No production procedure is a multi-subject repository; each directory has an obvious entry, bounded support files, and tests at that entry boundary.",
    evidence: [
      "agents/procedures/agents.ts: 1,535 lines / 59 exports",
      "new-tab/procedures/library.ts: 1,017 lines / 65 exports",
      "analysis/procedures/analysis.ts: 841 lines / 56 exports",
      "templates/api/shared/validation.ts: 1,687 lines",
      "document-editor/procedures/projection.ts: 704 lines"
    ]
  },
  {
    id: "ARCH-13",
    priority: "P2",
    area: "Reviewability and enforcement",
    title: "Architecture documentation describes an older system",
    finding:
      "The root capability document says three subjects answer although eight exist. The server document omits Store. WorkspaceState says nothing is persisted although restore/flush and workspace capabilities exist. Slide-presentation runtime documentation says writes and editor buffering are unbuilt although both are implemented.",
    consequence:
      "The tree is highly documented, but a reviewer cannot know whether prose or source is authoritative. This undermines the reviewability the documentation was created to provide.",
    recommendation:
      "Delete stale forward declarations and volatile hand-maintained counts. Generate inventories where possible, test key architecture claims, and make each object document state only durable ownership, lifetime, and invariants that code can verify.",
    acceptance:
      "Every architecture document agrees with the current graph and public API; CI checks generated inventories and the few semantic claims that can be encoded.",
    evidence: [
      "capabilities/capabilities.md",
      "runtime/server/server.md",
      "workspace-state/workspace-state.md",
      "presentation-runtimes/presentation-runtimes.md"
    ]
  },
  {
    id: "ARCH-14",
    priority: "P2",
    area: "Reviewability and enforcement",
    title: "The architecture ratchet now covers state and behavior segregation",
    finding:
      "The original suite proved dependency direction but left ownership, procedure placement, authority use, lifecycle balance, atomicity, authoritative data, and cohesion to manual review. Those gaps now map to 45 pillar contracts implemented by the complete 90-check graph.",
    consequence:
      "Existing infractions remain substantial, but they are now enumerated structurally. A merge cannot add another matching infraction without an explicit, owned, expiring baseline decision.",
    recommendation:
      "Treat the baseline as a removal queue: fix an infraction, delete its now-stale entry in the same change, and never regenerate the baseline merely to make CI green.",
    acceptance:
      "Every pillar contract is Enforced, every concrete checker is catalogued, every checker has a failing mutation, and new or stale debt makes the architecture command fail.",
    evidence: [
      "configuration/architecture-checkers.json",
      "configuration/architecture-baseline.json",
      "scripts/test/checker-catalog.test.mjs",
      "scripts/test/baseline.test.mjs",
      "pnpm lint --all: 90 checks clean"
    ]
  }
];

const GROUP_SUMMARIES: Readonly<Record<string, string>> = {
  "Authority and persistence":
    "The most urgent gaps are at the write boundary: authority is bypassable and multi-table intents are not atomic.",
  "Client state ownership":
    "The graph has the right large-grained owners, but render lifetime and prototype state still compete with them.",
  "Views and procedures":
    "Behavior has started moving out of markup, but direct crossings and category-scale procedure files keep the call graph difficult to review.",
  "Models and runtimes":
    "Model count is reasonable; definition thinness, hidden globals, and an unused model are the actual problems.",
  "Reviewability and enforcement":
    "The repository enforces dependency direction well and needs the same rigor for ownership, lifecycle, and complexity."
};

export const FINDING_GROUPS: readonly FindingGroup[] = Object.entries(GROUP_SUMMARIES).map(
  ([area, summary]) => ({
    area,
    summary,
    findings: FINDINGS.filter((finding) => finding.area === area)
  })
);

export const FINDING_TOTALS = {
  all: FINDINGS.length,
  p0: FINDINGS.filter((finding) => finding.priority === "P0").length,
  p1: FINDINGS.filter((finding) => finding.priority === "P1").length,
  p2: FINDINGS.filter((finding) => finding.priority === "P2").length
} as const;

export {
  GUARDRAILS,
  HOTSPOTS,
  MODEL_GRANULARITY,
  REMEDIATION,
  TARGET_SHAPE,
  gradeClass
} from "$development-views/state-behavior-audit/procedures/report/review";
