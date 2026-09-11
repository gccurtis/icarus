import type {
  DeliveryArea,
  DeliveryCommit,
  DeliveryFact
} from "$development-views/project-overview-delivery/types";

export const DELIVERY_RANGE = {
  before: "3e670c5",
  after: "930fb95",
  expression: "3e670c5..930fb95",
  beforeLabel: "main before integration",
  afterLabel: "verified merged head"
} as const;

export const DELIVERY_TOTALS = {
  commits: 3,
  files: 78,
  newFiles: 50,
  modifiedFiles: 28,
  additions: 5_156,
  deletions: 78,
  panels: 6,
  capabilityEntries: 7
} as const;

export const DELIVERY_COMMITS: readonly DeliveryCommit[] = [
  {
    id: "a2017b3",
    title: "Add context and inspector panels",
    purpose:
      "Introduced the six production views, their scoped project capability, shared panel vocabulary improvements, seed summaries, and the interactive visual reference."
  },
  {
    id: "a8f5023",
    title: "Satisfy integration contracts",
    purpose:
      "Moved remote calls, commands, and effects behind named procedures; made summary updates atomic; added ownership and recovery contracts; and retired the resolved architecture exception."
  },
  {
    id: "930fb95",
    title: "Stabilize Chromium text gestures",
    purpose:
      "Made the document regression scenario target rendered text instead of reusing stale or whitespace coordinates, and added an assertion that multi-selection typing preserves the intended block."
  }
];

export const DELIVERY_AREAS: readonly DeliveryArea[] = [
  {
    id: "product",
    label: "Production views",
    files: 21,
    additions: 1_203,
    deletions: 3,
    outcome: "Two context views and four inspector views now run inside the real Project Overview workspace.",
    details: [
      "Overview and History replace the unfinished Variables and Contexts rail destinations.",
      "Activity, Comment, Resource, and general Person lenses resolve from the selected project object.",
      "Component stateful commands, capability reads, clock effects, and filter synchronization live in named procedure modules."
    ]
  },
  {
    id: "capability",
    label: "Project capability",
    files: 22,
    additions: 1_697,
    deletions: 0,
    outcome: "A new server boundary returns bounded, project-scoped projections rather than generic represented rows.",
    details: [
      "Six queries cover overview, history, person, activity, comment, and resource detail.",
      "One command edits a resource summary and advances summary, timestamp, and editor atomically.",
      "Validators, public result types, shared projections, ownership tests, and transaction failpoint tests complete the boundary."
    ]
  },
  {
    id: "vocabulary",
    label: "Panel vocabulary",
    files: 7,
    additions: 200,
    deletions: 49,
    outcome: "Existing panel primitives gained bounded-content and hierarchy options instead of spawning project-only variants.",
    details: [
      "Titles, links, quoted text, timelines, and editable summaries can be clamped without losing full hover or expanded access.",
      "Field layouts can opt into hierarchy, proportional columns, and persistent editable affordances.",
      "All additions are opt-in, preserving existing document and presentation panel behavior."
    ]
  },
  {
    id: "reference",
    label: "Visual reference",
    files: 11,
    additions: 1_783,
    deletions: 0,
    outcome: "A responsive, interactive reference makes every target panel and its data provenance reviewable together.",
    details: [
      "Six mocks render at the 320 px review width and expose a long-content stress mode.",
      "A code-derived catalog records view keys, selection contracts, destinations, data owners, and design decisions.",
      "The demo route and navigation entry make the reference directly discoverable."
    ]
  },
  {
    id: "representation",
    label: "Representation and workspace",
    files: 15,
    additions: 34,
    deletions: 21,
    outcome: "Resource summaries and the new view keys are represented explicitly, with no compatibility reader for retired shapes.",
    details: [
      "Documents, presentations, spreadsheets, findings, and research threads now allow an authored executive summary.",
      "Fifteen seeded resources carry summaries; comment timestamps were aligned for coherent project history.",
      "Context Editor now has a visible unavailable screen, allowing its obsolete architecture baseline exception to be deleted."
    ]
  },
  {
    id: "browser",
    label: "Chromium evidence",
    files: 2,
    additions: 239,
    deletions: 5,
    outcome: "Browser contracts cover visual bounds, interaction, real production wiring, and the integration regression sequence.",
    details: [
      "The panel suite exercises all mocks, narrow layouts, long-content stress, real scoped reads, inspector navigation, and resize bounds.",
      "The document suite recomputes text coordinates after layout changes and targets the quote's final rendered word.",
      "The final merge gate passed all 57 Chromium scenarios."
    ]
  }
];

export const REPRESENTATION_FACTS: readonly DeliveryFact[] = [
  {
    label: "New field",
    value: "summary?: string",
    detail: "Added to document, presentation, spreadsheet, finding, and research-thread records."
  },
  {
    label: "Seed coverage",
    value: "15 resources",
    detail: "4 documents · 4 presentations · 2 spreadsheets · 2 findings · 3 research threads."
  },
  {
    label: "Project rail",
    value: "Overview · History",
    detail: "The two implemented contexts replace unfinished Variables and Contexts destinations."
  },
  {
    label: "New lens key",
    value: "project-overview.comment",
    detail: "Overview comments no longer borrow the independent general.comment inspector."
  },
  {
    label: "Unsupported category",
    value: "context-editor.unavailable",
    detail: "A real visible state replaces a stale baseline exception; no legacy implementation is synthesized."
  }
];

export const ARCHITECTURE_REPAIRS: readonly DeliveryFact[] = [
  {
    label: "Component crossings",
    value: "7 → 0",
    detail: "Executable capability imports moved from Svelte components into named view procedures."
  },
  {
    label: "Inline commands",
    value: "4 → 0",
    detail: "Comment and resource mutations now use instance-owned command controllers with explicit state."
  },
  {
    label: "Inline lifecycle chains",
    value: "4 → 0",
    detail: "Clock and filter effects have dedicated procedure modules and component-owned lifetimes."
  },
  {
    label: "Summary writes",
    value: "1 transaction",
    detail: "Summary, updatedAt, and updatedBy commit together or recover together across every durable boundary."
  },
  {
    label: "Legacy readers",
    value: "0 added",
    detail: "Comment anchors accept only the current discriminated within shape; the old single-block fallback was removed."
  },
  {
    label: "Baseline debt",
    value: "−1 entry",
    detail: "The context-editor unavailable-state exception was deleted after a real destination was added."
  }
];

export const VERIFICATION_FACTS: readonly DeliveryFact[] = [
  { label: "Type system", value: "0 errors", detail: "svelte-check over 2,737 files." },
  { label: "Architecture", value: "90 / 90 clean", detail: "295 existing baselines · 0 new findings." },
  { label: "Focused tests", value: "86 / 86", detail: "Project capability and integration-focused coverage." },
  { label: "Application tests", value: "1,111 / 1,111", detail: "111 test files at the merge boundary." },
  { label: "Chromium", value: "57 / 57", detail: "Complete serial browser gate on the merged tree." },
  { label: "Production build", value: "Passed", detail: "Typecheck and Vite production compilation completed successfully." }
];
