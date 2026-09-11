import type { Investigation } from "$development-views/backlog-investigations/types";

export const RESEARCH_AND_EXECUTION: readonly Investigation[] = [
  {
    id: "research-acceptance",
    number: "02",
    label: "Research",
    prompt: "How do findings and sources move from a research turn into project knowledge?",
    status: "resolved",
    verdict: "Treat turn output as immutable evidence and acceptance as a separate, atomic publication decision.",
    answer:
      "A completed research turn is a record of what the system produced, not the semantic overlay itself. Findings and sources should each be inspectable proposals. Accepting one writes a separate decision record and, when applicable, atomically creates the canonical project object; it never edits the historical turn in place and never silently accepts the other item.",
    observed: [
      "Research turns persist local findings and sources, including the finding-to-source IDs used in that answer.",
      "Canonical findings already have their own representation, revision, provenance, source references, and optional links back to a research thread and question.",
      "The research inspector renders findings and sources as output rows but exposes no item-level selection, acceptance, dismissal, or publication state.",
      "Current research source references must point to existing project ResourceRefs, and Web is disabled in the composer. The model cannot represent a newly discovered URL awaiting admission.",
      "Research threads carry findingIds, but no production capability creates canonical findings or appends those IDs; current canonical findings come from fixtures.",
      "Research turns are written transactionally as running and then answered; acceptance is not part of that operation and should not rewrite it."
    ],
    contract: [
      { concern: "Proposal identity", decision: "Every proposed finding and source keeps a stable turn-local ID. The completed turn and its citations remain immutable evidence." },
      { concern: "Decision state", decision: "Store a separate decision per item: pending, accepted, dismissed, or superseded, with actor, time, reason, and canonical result reference." },
      { concern: "Finding acceptance", decision: "Atomically create one canonical Finding, append its ID to the thread, record activity/decision, and enqueue semantic work; make retry idempotent through the accepted result reference." },
      { concern: "Source acceptance", decision: "Existing project citations remain references and are never duplicated. A newly discovered web item first becomes a durable candidate; acceptance atomically admits its exact reviewed payload as an External File with a research origin before indexing." },
      { concern: "Independence", decision: "A source may be accepted without its finding and a finding without importing every source. The finding keeps immutable citation snapshots for evidence not admitted as a resource." },
      { concern: "Rejection", decision: "Dismissal preserves evidence and reason. Supersession points to the replacement proposal or canonical finding; neither state deletes history." }
    ],
    alternatives: [
      { option: "Independent proposal decisions", benefit: "Full provenance, explicit consent, retry safety, and no mutation of generated history.", cost: "Requires decision rows and a candidate-source admission path.", decision: "recommend" },
      { option: "Accept finding and all sources", benefit: "One simple action.", cost: "Imports sources the user did not approve and conflates confidence in a claim with desire to retain every source.", decision: "reject" },
      { option: "Mark fields on the turn", benefit: "Fewer tables.", cost: "Turns become mutable workflow records, concurrent decisions are fragile, and canonical result linkage is underspecified.", decision: "reject" }
    ],
    sequence: [
      "Add current-schema proposal-decision rows keyed by thread, turn, item kind, and item ID.",
      "Add independent inspect/accept/dismiss procedures with server-owned project and source validation.",
      "Add a bounded external-source candidate with URL, capture time, title, excerpt, MIME type, exact content hash, staged payload identity, and owning turn/source identity.",
      "Create a transactional source-admission path that retains retrieval and acceptance provenance, activity, history, and semantic outbox intent.",
      "Publish accepted findings and external files to the semantic overlay only through their canonical revisions.",
      "Render pending/accepted/dismissed/superseded states beside each finding and source, with an inspectable audit trail."
    ],
    acceptance: [
      "Accepting the same proposal twice returns the same canonical result and creates no duplicate finding or file.",
      "Storage failure leaves neither a half-created canonical object nor a decision falsely marked accepted.",
      "A source and its citing finding can be accepted or dismissed independently in all four combinations.",
      "The original completed answer, excerpts, locators, and citation mapping remain byte-for-byte unchanged after decisions.",
      "A newly discovered accepted source records exact provenance and appears as an External File only after explicit acceptance."
    ],
    evidence: [
      { path: "app/src/lib/representation/store/tables/investigation.ts", finding: "Canonical FindingFields and turn-local ResearchFinding/ResearchSource are distinct represented shapes." },
      { path: "app/src/lib/representation/data/types/investigation/research-turn.ts", finding: "Every current ResearchSource requires a ResourceRef, so it already names project material rather than an external candidate." },
      { path: "app/src/lib/capabilities/research-chat/api/ask/ask.ts", finding: "The capability persists the turn lifecycle and snapshots result sources/findings, but contains no acceptance transition." },
      { path: "app/src/lib/app-views/categories/research/inspector/turn.svelte", finding: "Findings and Sources are displayed but have no proposal-state or acceptance controls." },
      { path: "app/src/lib/app-views/categories/research/components/composer.svelte", finding: "Web search is visible but disabled, matching the absence of external source candidates." },
      { path: "app/src/lib/representation/data/types/external/file.ts", finding: "External File origin currently supports only upload or connector; explicit research-source admission needs its own current origin arm." }
    ]
  },
  {
    id: "chat-task-persona",
    number: "03",
    label: "AI execution",
    prompt: "Where are the boundaries between chats, tasks, personas, tools, and Skills?",
    status: "resolved",
    verdict: "Conversation, durable work, behavior, context, authority, and capability are separate axes.",
    answer:
      "Chat and task should share conversational primitives but not a lifecycle. A chat is user-directed turn-taking; a task is a durable delegated command with plan, execution, questions, outputs, and review. Persona describes behavior and reusable scope, tools are explicit grants on the chat/task invocation, and Skills are versioned execution material—not authority.",
    observed: [
      "A research turn partially snapshots execution—mode, scope, and a requested tool list—but the remaining mutable lookups prevent complete historical interpretation.",
      "A research turn does not snapshot persona identity/revision/definition. Prior turns are rendered against the thread’s current persona, so later edits can rewrite their apparent provenance.",
      "Research settlement rereads the thread’s current mode after asynchronous work; changing mode while a turn runs can mislabel the completed turn.",
      "Agent tasks already have a distinct running/review/finished lifecycle plus plan, execution, questions, outputs, scope, and tools.",
      "Threads can record a BranchPoint, but admission validates only field shapes, reads ignore ancestry, and the current tree has no production branch writer or complete UI.",
      "Personas currently persist scope, tools, and an unused model-preference cast. That conflicts with the settled product direction that tools are selected per chat or task.",
      "Research turns store a narrow requested tool list, but execution derives grants from the persona and constructs only retrieval tools; the stored chat tool selection is not authoritative and web.search is not implemented."
    ],
    contract: [
      { concern: "Chat", decision: "An ordered conversation whose next turn is initiated and steered by a user. It may invoke tools for that turn but has no autonomous completion lifecycle." },
      { concern: "Task", decision: "A durable command with objective, execution snapshot, progress/questions, produced resources, review, cancellation, and terminal state." },
      { concern: "Branch", decision: "A new thread points to an immutable ancestor thread + turn boundary, inherits the visible conversation prefix, then owns independent future turns and configuration." },
      { concern: "Branch safety", decision: "Prove same project/kind, a complete boundary, bounded acyclic ancestry, and an expected thread head. Retain parents while descendants exist; race losers branch rather than overwrite." },
      { concern: "Configuration timing", decision: "Persona ID + exact revision/definition, mode, resolved scope, Skills, tools, and relevant model configuration are snapshotted when a turn/task attempt begins and used through settlement." },
      { concern: "Persona", decision: "Behavioral instructions and reusable resource scope only. Remove tools and unused cast; it neither grants authority nor carries model/cost/retry policy." },
      { concern: "Tools", decision: "Explicit per-chat/per-task grants, validated at execution. A remembered UI choice may prefill a future request but is not authority." },
      { concern: "Skills", decision: "Versioned, inspectable instruction/capability assets referenced and snapshotted by executions. A Skill can explain tool use but cannot grant a tool." }
    ],
    alternatives: [
      { option: "Orthogonal execution axes", benefit: "Clear authority, historical reproducibility, reusable personas, and independent task/chat evolution.", cost: "The execution snapshot is richer and must be shown deliberately.", decision: "recommend" },
      { option: "Persona as complete preset", benefit: "One selection configures everything.", cost: "Behavior becomes hidden authority; persona edits silently alter future access and confuse audit history.", decision: "reject" },
      { option: "Chat and task share one lifecycle", benefit: "Fewer types and screens.", cost: "Either chats acquire irrelevant completion/review state or tasks lose durable command semantics.", decision: "reject" }
    ],
    sequence: [
      "Add one immutable execution snapshot and use it through asynchronous execution/settlement; stop rendering past turns from mutable thread/persona state.",
      "Remove persona tools/cast and all runtime fallback to persona-provided grants in one current-schema change. Put chat defaults on the research thread and task grants on the task.",
      "Complete branch creation and ancestor projection at a specific turn boundary, including concurrent continuation by another user.",
      "Introduce versioned Skills as referenced execution material with explicit provenance, not as a new permission source.",
      "Keep any reusable execution presets separate from personas until a real repeated workflow proves their need."
    ],
    acceptance: [
      "Editing a persona never changes an answered turn, a running task, or the grants recorded for either.",
      "Changing mode/persona/scope/tools during an in-flight turn affects only the next turn; settlement retains the opening snapshot.",
      "A task can wait for a question, resume, enter review, and finish; a chat can continue without pretending to be a task.",
      "Branching from turn N shows exactly the ancestor prefix through N and never appends new turns to the source thread.",
      "Concurrent continuation preserves both lines; cross-project, wrong-kind, missing, cyclic, or mismatched branch points are rejected.",
      "Removing a tool from an invocation prevents its use even when the selected persona previously included it.",
      "A Skill version used by an execution remains inspectable after the Skill’s current version changes."
    ],
    evidence: [
      { path: "app/src/lib/representation/store/tables/investigation.ts", finding: "Threads, branch points, turn snapshots, research tools, and findings/sources are represented here." },
      { path: "app/src/lib/representation/data/types/agents/agent-task.ts", finding: "Tasks already own a lifecycle and artifacts distinct from a chat turn." },
      { path: "app/src/lib/representation/store/tables/agents.ts", finding: "The current persona row includes scope, persistent tools, and cast alongside behavioral definition." },
      { path: "app/src/lib/capabilities/research-chat/api/ask/ask.ts", finding: "Effective tool grants currently flow from the active persona/default, despite per-turn tool selection." },
      { path: "app/src/lib/app-views/categories/research/content/thread.svelte", finding: "Past-turn presentation reads the thread’s current persona rather than immutable turn provenance." },
      { path: "app/src/lib/capabilities/agents/api/shared/execute-agent-task.ts", finding: "Task execution consumes its own persisted plan/scope/tool configuration and lifecycle." }
    ]
  }
];
