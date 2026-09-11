import { CONTENT_AND_PLATFORM } from "$development-views/backlog-investigations/procedures/content-and-platform";
import { EXTERNAL_AND_COLLABORATION } from "$development-views/backlog-investigations/procedures/external-and-collaboration";
import { RESEARCH_AND_EXECUTION } from "$development-views/backlog-investigations/procedures/research-and-execution";
import type {
  Investigation,
  Principle,
  ReviewDecision
} from "$development-views/backlog-investigations/types";

const byNumber = (left: Investigation, right: Investigation): number =>
  Number(left.number) - Number(right.number);

export const INVESTIGATIONS = [
  ...EXTERNAL_AND_COLLABORATION,
  ...RESEARCH_AND_EXECUTION,
  ...CONTENT_AND_PLATFORM
].sort(byNumber);

export const REPORT = {
  auditedAt: "10 September 2026",
  base: "main · c2505f0",
  method: "Current-tree source audit · product contract synthesis · primary platform sources",
  headline: "The investigations converge on one system shape: generated work remains inspectable until an explicit, authorized transition makes it canonical.",
  summary:
    "All seven scoped backlog investigations and both repeated UX questions now have implementable answers. No investigation requires an exploratory prototype before architecture can begin. Four product choices merit owner confirmation; the rest follow existing settled decisions and current code evidence.",
  auditedQuestions: 9,
  ownerChoices: 4
} as const;

export const PRINCIPLES: readonly Principle[] = [
  { label: "Truth", statement: "Exact facts, generated interpretation, authored correction, and system health remain visibly distinct." },
  { label: "Publication", statement: "Generated output is immutable evidence; a separate decision atomically creates canonical project state." },
  { label: "Execution", statement: "Behavior, scope, Skills, and authority are separate inputs snapshotted when a turn or task begins." },
  { label: "Identity", statement: "Canonical objects own meaning and revision history; editor placements own local presentation." },
  { label: "Ownership", statement: "Personal and project assets share scope/provenance rules while retaining type-specific bodies and invariants." },
  { label: "Input", statement: "Editing gestures belong to the active editor; workspace shortcuts respect focus and the host boundary." }
];

export const REVIEW_DECISIONS: readonly ReviewDecision[] = [
  {
    id: "DEC-01",
    title: "May a finding be accepted without importing each cited source?",
    context:
      "A research finding and a source answer different questions: whether a claim belongs in project knowledge, and whether source material should become a retained External File. Automatically coupling them turns claim acceptance into an implicit ingestion action.",
    recommendation:
      "Yes. Decide on each finding and source independently. An accepted finding keeps immutable citation snapshots; an accepted new source separately creates an External File with retrieval and acceptance provenance.",
    effect:
      "If coupled, the UI and transaction become simpler, but source consent is no longer explicit and accepting one finding may import material the user did not intend to retain."
  },
  {
    id: "DEC-02",
    title: "Should native chart paste link by default?",
    context:
      "The backlog settles that charts are portable canonical objects. The remaining question is whether ordinary native paste creates another view of that object or immediately forks its data and chart definition.",
    recommendation:
      "Link by default inside an authorized project. Position and size remain local. Offer Duplicate/Detach as an explicit operation that creates a new analytic identity and lineage.",
    effect:
      "Copy-by-value avoids dependency handling but contradicts the settled propagation goal. Link-only without Detach makes reuse brittle when ownership or lifecycle diverges."
  },
  {
    id: "DEC-03",
    title: "Does a persona carry a reusable execution policy?",
    context:
      "A persona’s behavioral instructions and reusable scope describe how to work and what context is useful. Tool grants and execution policy determine authority, cost, and side effects; hiding those inside persona selection weakens consent and auditability.",
    recommendation:
      "No authoritative policy on personas. Configure tools and execution controls per chat/task and snapshot them per execution. If repeated configuration later proves valuable, add a separate visible execution preset.",
    effect:
      "Keeping policy on personas offers one-click setup, but persona edits can silently change future authority and reviewers cannot tell whether behavior or permissions caused an outcome."
  },
  {
    id: "DEC-04",
    title: "How long should an unaccepted web-source payload be retained?",
    context:
      "To accept exactly what a user reviewed, Icarus must either stage the captured bytes before acceptance or refetch later and risk changed content. Retention affects security, storage, and user expectations, so it should be explicit rather than hidden in implementation.",
    recommendation:
      "Keep a bounded staged payload with a visible expiry, recommended at 30 days by default, and delete it immediately on dismissal. Acceptance promotes the exact hash; expired candidates require a disclosed recapture and new review.",
    effect:
      "Refetch-on-accept stores less unaccepted data but cannot promise the accepted source matches the reviewed excerpt. Indefinite staging preserves exactness but creates unnecessary retention and cleanup risk."
  }
];

export const SOURCE_ANCHOR_COUNT = INVESTIGATIONS.reduce(
  (total, investigation) => total + investigation.evidence.length,
  0
);
