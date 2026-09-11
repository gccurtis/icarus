import type {
  AuditArea,
  FindingStatus,
  RemediationPhase
} from "$development-views/editor-audit/types";

export const AREAS: readonly AuditArea[] = [
  "Creation and runtime",
  "Document editor",
  "Presentation editor",
  "Across both editors",
  "Quality system"
];

export const statusClass = (status: FindingStatus): string =>
  status === "Fixed in this audit"
    ? "is-fixed"
    : status === "Confirmed"
      ? "is-confirmed"
      : status === "Coverage gap"
        ? "is-gap"
        : "is-recommendation";

export const REQUEST_LEDGER = [
  ["Control adds distinct highlights; Shift spans between", "DOC-02, DOC-04, DOC-05", "Fixed + verified"],
  ["Section panel prioritizes H-level, title, and page", "DOC-06", "Fixed + verified"],
  ["Remove Usage, Placement, Key, Reads as; edit style name", "DOC-07, DOC-09", "Fixed + verified"],
  ["Named Style mirrors text formatting controls", "DOC-07, DOC-08, PRESENTATION-06", "Fixed + verified"],
  ["Partial header/footer authoring is withdrawn; page numbers remain", "DOC-10", "Fixed + verified"],
  ["Repair wonky incident and decision documents", "DOC-01", "Fixed + verified"],
  ["Comment creation must not stick or throw console errors", "DOC-03, CRT-01", "Fixed + verified"],
  ["Disjoint text selections cannot start a comment", "DOC-03", "Decision applied + verified"],
  ["Arrange rows, relative-to, and match-size", "PRESENTATION-02–PRESENTATION-04", "Fixed + verified"],
  ["Repeated Distribute reaches the same stable result", "PRESENTATION-01", "Fixed + verified"],
  ["Shape inspector identifies kind and text", "PRESENTATION-05", "Fixed + verified"],
  ["Presentation named styles and notes match text inspector language", "PRESENTATION-06, PRESENTATION-07, BOTH-03", "Fixed + verified"],
  ["Find never collapses into ambiguous letters", "PRESENTATION-02", "Fixed + verified"],
  ["Comment composer/order matches across editors", "BOTH-01, BOTH-02", "Fixed + verified"],
  ["Create document/presentation works; other three alert", "CRT-01–CRT-06", "Fixed + verified"],
  ["Next Letter shows comments and links under the caret", "DOC-11", "Fixed + verified"]
] as const;

export const PHASES: readonly RemediationPhase[] = [
  {
    name: "Creation + persistence",
    tone: "fixed",
    items: ["Real IDs and snapshots", "Editor-ready first content", "Truthful Saving state", "Reload durability"]
  },
  {
    name: "Correctness",
    tone: "fixed",
    items: ["Normalize document leading", "Stabilize Control gestures", "Require contiguous comments", "Make Distribute idempotent"]
  },
  {
    name: "Inspector clarity",
    tone: "fixed",
    items: ["Recompose style/layout panels", "Repair responsive choices", "Add presentation Named Style", "Unify comment sequence"]
  },
  {
    name: "Guardrails",
    tone: "fixed",
    items: ["Isolate browser stores", "Reset every represented table", "Add regression matrices", "Split audit modules"]
  }
];

export const CONSISTENCY_MATRIX = [
  ["Style identity", "Editable title; no Identity/Usage", "Editable title; dedicated lens", "Independent copies"],
  ["Typography", "Font · Size · B I U S", "Font · Size · B I U S", "Same order"],
  ["Color", "Color · Background", "Color · Background", "Same vocabulary"],
  ["Body", "Align · spacing · list/indent", "Horizontal · vertical · spacing · indent", "Domain-appropriate tail"],
  ["Line height", "Absolute pixels", "Unitless ratio", "Never reuse semantics"],
  ["Comments", "Inline-range locate", "Slide/element locate", "Same visual sequence"],
  ["Responsive choices", "Full words → unique compact label", "Full words → unique compact label", "Never duplicate initials"]
] as const;
