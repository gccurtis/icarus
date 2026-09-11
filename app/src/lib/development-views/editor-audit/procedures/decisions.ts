import type { DecisionBrief } from "$development-views/editor-audit/types";

export const DECISIONS: readonly DecisionBrief[] = [
  {
    id: "DEC-01",
    kind: "Product decision",
    question: "What scope should a document header or footer have?",
    stakes: "This choice changes what the editor promises today without requiring destructive changes to represented document data.",
    context: [
      "The document representation can store global and first-page header/footer rows. The withdrawn editor implementation rendered the first page as rich editable blocks but flattened later pages into generic text, so one logical header had visibly different results.",
      "The current representation reserves global and first-page furniture for the eventual parity-safe feature. The editor leaves those roots untouched and unrendered. Page numbering remains available through a small independent projection because its current storage lives on the same represented objects."
    ],
    recommendation: {
      optionId: "defer-authoring",
      rationale: "Withdraw authoring until one structured renderer can make editable and repeated occurrences visually identical. Keep the current represented furniture explicit and page numbering isolated, so the future feature can return without preserving a known-buggy UI."
    },
    decision: {
      optionId: "defer-authoring",
      direction: "Supersedes the 2026-09-06 direction. Header/footer authoring is withdrawn from the editor; represented data is retained untouched, and page numbering remains available independently.",
      recordedAt: "2026-09-07"
    },
    criteria: [
      { id: "reflow", label: "Reflow stability", explanation: "Whether the right furniture remains attached when pagination changes." },
      { id: "clarity", label: "Mental model", explanation: "Whether scope is obvious from the control and canvas." },
      { id: "power", label: "Authoring power", explanation: "How many real publishing cases the option covers." },
      { id: "architecture", label: "Representation cost", explanation: "Schema, operation, migration, and paginator complexity." },
      { id: "reversible", label: "Reversibility", explanation: "How safely we can extend or change the choice later." }
    ],
    options: [
      {
        id: "defer-authoring",
        label: "Defer authoring",
        summary: "Hide header/footer content and controls until one parity-safe implementation is ready; preserve represented data.",
        tradeoffs: { reflow: "Strong — no partial renderer", clarity: "Strong — no misleading capability", power: "Deferred", architecture: "Lower editor complexity; representation remains", reversible: "Strongest" }
      },
      {
        id: "document-wide",
        label: "Document-wide now",
        summary: "One header and footer repeat on every page; the UI states that scope plainly.",
        tradeoffs: { reflow: "Strong — scope never depends on page position", clarity: "Strong with an explicit all-pages label", power: "Covers the common case", architecture: "Low; already represented", reversible: "Strong extension path" }
      },
      {
        id: "structured-variants",
        label: "Structured variants now",
        summary: "Add first-page and odd/even variants, with section variants only after sections become represented layout units.",
        tradeoffs: { reflow: "Strong when variants are semantic", clarity: "Good, but needs a scope chooser", power: "High for formal documents", architecture: "Medium to high", reversible: "Good if introduced additively" }
      },
      {
        id: "per-page",
        label: "Physical page overrides",
        summary: "Let each currently rendered page own different furniture.",
        tradeoffs: { reflow: "Weak — page identity changes", clarity: "Looks simple until content moves", power: "High but fragile", architecture: "Very high", reversible: "Poor; ambiguous migrations" }
      }
    ]
  },
  {
    id: "DEC-02",
    kind: "Product decision",
    question: "When one comment is added to several disjoint selections, is it one conversation or several?",
    stakes: "The current anchor can carry several spans, but the surrounding UI and lifecycle need one explicit semantic contract. The answer affects reply history, resolving, locating, and what happens when one selected span is edited away.",
    context: [
      "At the start of the audit, a multi-selection produced one thread with multiple text spans. The crash came from projecting that same thread once per span, not from an inability to represent the relationship. Deduplicating the projection remains necessary for historical data.",
      "The recorded choice prevents new disjoint anchors: formatting can still act on several ranges, but comment composition appears only for one continuous selection. A continuous selection may cross block boundaries; a Control/Command-added secondary range is what makes it disjoint."
    ],
    recommendation: {
      optionId: "one-thread-many-anchors",
      rationale: "Keep one conversation with many anchors. Show the thread once, expose every surviving anchor when locating it, and keep the conversation open if one anchor is deleted. This preserves why the user made a disjoint selection in the first place."
    },
    decision: {
      optionId: "selection-only",
      direction: "Require one contiguous selection. A disjoint Control/Command multi-selection may still be formatted, but it cannot start a comment thread.",
      recordedAt: "2026-09-06"
    },
    criteria: [
      { id: "intent", label: "Intent fidelity", explanation: "Whether the result preserves the relationship the author selected." },
      { id: "conversation", label: "Conversation integrity", explanation: "Whether replies and resolution have an understandable owner." },
      { id: "locate", label: "Locate behavior", explanation: "How clearly Show can reveal all affected text." },
      { id: "editing", label: "Edit resilience", explanation: "What happens as individual anchors move or disappear." },
      { id: "architecture", label: "Model cost", explanation: "New representation and lifecycle complexity." }
    ],
    options: [
      {
        id: "one-thread-many-anchors",
        label: "One thread, many anchors",
        summary: "One discussion describes the selected relationship and appears once in every relevant inspector.",
        tradeoffs: { intent: "Strong", conversation: "One reply and resolve lifecycle", locate: "Must reveal multiple anchors", editing: "Thread survives partial detachment", architecture: "Already represented; moderate UI work" }
      },
      {
        id: "thread-per-anchor",
        label: "A thread per range",
        summary: "Create independent copies of the initial comment for each selected span.",
        tradeoffs: { intent: "Relationship is fragmented", conversation: "Independent and simple", locate: "One destination each", editing: "Local failures are isolated", architecture: "Duplication and synchronization choices" }
      },
      {
        id: "selection-only",
        label: "Require one contiguous range",
        summary: "Disable Add comment while a disjoint selection is active and explain why.",
        tradeoffs: { intent: "Cannot express cross-passage review", conversation: "Very simple", locate: "Very simple", editing: "Strong", architecture: "Lowest, but removes capability" }
      }
    ]
  },
  {
    id: "DEC-03",
    kind: "Product decision",
    question: "How should named-style changes interact with local text formatting?",
    stakes: "This determines whether changing Heading 2 is a global design action, a one-time preset, or a strict rule. It also determines what the inspector must communicate as inherited versus overridden.",
    context: [
      "The document already stores a style key on the block and separate inline marks on text. That supports a cascade: the named style supplies defaults and local marks supply exceptions. The current panel obscures that relationship by presenting metadata fields instead of the same visual formatting language.",
      "A visual copy of the text controls is not enough by itself. Without a precedence contract, Bold can be represented both in a style and in local marks, and Reset to style has no dependable meaning."
    ],
    recommendation: {
      optionId: "cascade-overrides",
      rationale: "Treat the named style as live inherited defaults, retain explicit local overrides, and show an inherited/overridden state with Reset to style. Global style edits then remain useful without taking away precise exceptions."
    },
    decision: {
      optionId: "cascade-overrides",
      direction: "Approved. Apply the named style as the inherited base, then apply local formatting and marks with stronger precedence.",
      recordedAt: "2026-09-06"
    },
    criteria: [
      { id: "global", label: "Global editing", explanation: "Whether one style edit updates every use." },
      { id: "exceptions", label: "Local exceptions", explanation: "Whether authors can intentionally diverge in one place." },
      { id: "clarity", label: "Inspector clarity", explanation: "Whether the source and precedence of a value are visible." },
      { id: "roundtrip", label: "Round-trip safety", explanation: "Whether stored values render and edit without conflict." },
      { id: "migration", label: "Migration cost", explanation: "Risk to existing styled documents and templates." }
    ],
    options: [
      {
        id: "cascade-overrides",
        label: "Live cascade + overrides",
        summary: "Named styles provide defaults; explicit block or inline values win and can be reset.",
        tradeoffs: { global: "Strong for non-overridden values", exceptions: "Strong", clarity: "Needs visible provenance", roundtrip: "Strong with one precedence rule", migration: "Moderate normalization" }
      },
      {
        id: "strict-style",
        label: "Strict named styles",
        summary: "A named style always wins; local formatting is removed or disabled on styled content.",
        tradeoffs: { global: "Strongest", exceptions: "Weak", clarity: "Simple", roundtrip: "Simple after destructive cleanup", migration: "High and potentially lossy" }
      },
      {
        id: "snapshot-preset",
        label: "One-time style preset",
        summary: "Choosing a style copies values onto the block; later named-style edits do not cascade.",
        tradeoffs: { global: "Weak", exceptions: "Strong but indistinguishable", clarity: "Style name becomes misleading", roundtrip: "Many duplicate values", migration: "Low initially; long-term drift" }
      }
    ]
  },
  {
    id: "DEC-04",
    kind: "Product decision",
    question: "What should Distribute do when selected objects overlap or do not fit between the outer objects?",
    stakes: "The current math permits a negative gap and can reorder mixed-size objects, which is why repeated clicks keep changing the presentation. Any fix must define the intended geometry, not just suppress the second click.",
    context: [
      "For ordinary non-overlapping objects, equal gaps and equal center intervals can look similar. They diverge with mixed sizes and overlap. Keeping the outer bounds fixed while demanding non-negative equal gaps can be mathematically impossible.",
      "The invariant I consider non-negotiable is idempotence: once distributed, pressing the same command again must emit no operation. Stable ordering, epsilon comparison, and coordinate canonicalization belong in every option."
    ],
    recommendation: {
      optionId: "stable-centers",
      rationale: "Preserve the initial axis order, keep the two outer centers fixed, and place intervening centers at equal intervals. This is deterministic, never changes order, works even when shapes overlap, and is easy to explain and test."
    },
    decision: {
      optionId: "stable-centers",
      direction: "Approved. Distribution uses stable center intervals.",
      recordedAt: "2026-09-06"
    },
    criteria: [
      { id: "stable", label: "Idempotence", explanation: "Whether a second invocation is a true no-op." },
      { id: "bounds", label: "Boundary preservation", explanation: "Whether the outer selected objects stay put." },
      { id: "visual", label: "Visual spacing", explanation: "How balanced mixed-size objects appear." },
      { id: "overlap", label: "Overlap behavior", explanation: "Whether every valid selection has a defined result." },
      { id: "explain", label: "Explainability", explanation: "How easily a user can predict the operation." }
    ],
    options: [
      {
        id: "stable-centers",
        label: "Stable center intervals",
        summary: "Keep outer centers and original order; equalize the center-to-center interval.",
        tradeoffs: { stable: "Strong", bounds: "Centers stay fixed", visual: "Balanced positions; gaps vary by size", overlap: "Always defined", explain: "Strong with center wording" }
      },
      {
        id: "expand-for-gaps",
        label: "Equal gaps, expand bounds",
        summary: "Keep order and create non-negative equal edge gaps, moving the outer objects if required.",
        tradeoffs: { stable: "Strong", bounds: "Weak when space is insufficient", visual: "Strong edge spacing", overlap: "Removes overlap", explain: "Surprising outer movement" }
      },
      {
        id: "refuse-overlap",
        label: "Refuse impossible spacing",
        summary: "Use equal edge gaps only when they fit; otherwise disable the action and explain the constraint.",
        tradeoffs: { stable: "Strong", bounds: "Strong", visual: "Strong when available", overlap: "No result for common selections", explain: "Clear but restrictive" }
      }
    ]
  },
  {
    id: "DEC-05",
    kind: "Working agreement",
    question: "For the remaining editor decisions, where should I proceed autonomously and where should I stop for you?",
    stakes: "Most of the audit has one clear, reversible implementation path. Asking you to adjudicate every control would slow the repair and transfer architecture work back to you; assuming authority over product semantics or destructive migrations would go too far.",
    context: [
      "I can independently resolve observable defects, accessibility failures, responsive breakage, test isolation, bounded-file refactors, and visual consistency where your stated direction is unambiguous. Those changes are locally testable and reversible.",
      "I should still surface decisions that change represented meaning, create a new long-lived content model, discard authored data, or leave two plausible user expectations. DEC-01 through DEC-04 are the current set that crosses that line; the rest can proceed under the acceptance criteria in the finding register."
    ],
    recommendation: {
      optionId: "guardrailed-delegation",
      rationale: "Delegate reversible design and implementation choices to me, with a stop only for represented-model expansion, data-loss/migration risk, or unresolved product semantics. I will record consequential choices and their evidence on this audit page."
    },
    decision: {
      optionId: "guardrailed-delegation",
      direction: "Approved. Proceed autonomously on reversible work and stop at semantic, represented-model, migration, or data-loss boundaries.",
      recordedAt: "2026-09-06"
    },
    criteria: [
      { id: "speed", label: "Delivery speed", explanation: "How much work can continue without a decision round trip." },
      { id: "control", label: "Design control", explanation: "How directly you shape consequential product behavior." },
      { id: "coherence", label: "Architecture coherence", explanation: "Whether one owner can keep implementation decisions consistent." },
      { id: "interruptions", label: "Decision load", explanation: "How many low-value questions reach you." },
      { id: "risk", label: "Reversal risk", explanation: "Chance that autonomous work locks in the wrong meaning." }
    ],
    options: [
      {
        id: "guardrailed-delegation",
        label: "Delegate with guardrails",
        summary: "I proceed on reversible work and stop only at semantic, model, or data-loss boundaries.",
        tradeoffs: { speed: "High", control: "Focused on consequential choices", coherence: "Strong", interruptions: "Low", risk: "Low with explicit boundaries" }
      },
      {
        id: "approve-recommendations",
        label: "Approve every recommendation",
        summary: "Treat all current recommendations, including DEC-01 through DEC-04, as approved unless implementation uncovers new risk.",
        tradeoffs: { speed: "Highest", control: "Exercised through this audit", coherence: "Strong", interruptions: "Lowest", risk: "Moderate on product semantics" }
      },
      {
        id: "review-every-phase",
        label: "Review each phase",
        summary: "Pause before each correctness, inspector, and quality-system phase for approval.",
        tradeoffs: { speed: "Low", control: "Highest", coherence: "Shared across many handoffs", interruptions: "High", risk: "Lowest per individual change" }
      }
    ]
  }
];
