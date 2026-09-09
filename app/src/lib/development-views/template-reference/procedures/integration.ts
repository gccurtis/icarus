import type { ChainLink, ScopeFork } from "$development-views/template-reference/types";

/**
 * The chain from writing a prompt to reading a filled copy, link by link.
 *
 * Four links are the base branch's, two are this branch's, and one — the one
 * that turns a prompt somebody wrote into a hole somebody answers — belongs to
 * neither yet. It is written here as plainly as the ones that work, because a
 * chain is only as interesting as the link that is open.
 */
export const CHAIN: ChainLink[] = [
  {
    index: "01",
    step: "A prompt is written into a document or a slide",
    gesture: "Convert a text box, type what it should derive, press Generate",
    runs: "createDerivedOutput · refreshDerivedOutput · the prompt-block inspector",
    state: "works",
    evidence: "slide-deck-editor.spec.ts — a text box becomes an editable slide Prompt Block"
  },
  {
    index: "02",
    step: "The prompt is told what to read",
    gesture: "The Scope control in the prompt inspector",
    runs: "Nothing. The control offers one option, “Whole project”, and is bound to no handler",
    state: "stub",
    evidence: "document-editor/inspector/prompt-block.svelte — SCOPES has one entry and PanelSelect takes no onchange"
  },
  {
    index: "03",
    step: "The resource is saved as a template",
    gesture: "Templates panel · a name · Save",
    runs: "createTemplateFromResource → portable() → declaredFor()",
    state: "works",
    evidence: "template-features.spec.ts — a document is saved as a template"
  },
  {
    index: "04",
    step: "The prompt's scope becomes a hole to be answered",
    gesture: "None — nothing performs this",
    runs: "declaredFor reads { select: \"hole\" } terms out of prompt scopes. An authored prompt has a settled scope, so nothing is declared",
    state: "missing",
    evidence: "templates/test/unit/answers.test.ts — keeps an authored prompt scope settled, and so declares no hole for it"
  },
  {
    index: "05",
    step: "Placing the template asks what fills each hole",
    gesture: "Insert or Use · one modal · a scope builder or a textarea per hole",
    runs: "answerRowsOf · the scope builder · normalizeScope",
    state: "works",
    evidence: "template-features.spec.ts — inserting a template asks for each hole"
  },
  {
    index: "06",
    step: "The copy reads what was said",
    gesture: "None — it is already true of the resource that lands",
    runs: "resolveTemplateScopes substitutes each hole term; fillTemplateAtoms fills each text hole",
    state: "works",
    evidence: "template-features.spec.ts — a hole's default is built with an exclusion, stored, and read back"
  },
  {
    index: "07",
    step: "The copy's prompts generate against what was said",
    gesture: "Press Generate in the copy",
    runs: "The base's derived-output runtime, over the scope this branch resolved",
    state: "works",
    evidence: "Follows from 06: the copy is an ordinary resource holding ordinary prompt blocks"
  }
];

export const CHAIN_DIAGRAM = `flowchart LR
  subgraph authoring["01–02 · Authoring — the base"]
    direction TB
    B{{"Scope control<br/>one option, not wired"}}
    A["A prompt block<br/>scope: whole project"]
    B -. "writes no term" .-> A
  end
  subgraph making["03–04 · Making a template — here"]
    direction TB
    C["portable()<br/>drops the generated answer"]
    D["declaredFor()<br/>looks for hole terms"]
    C --> D
  end
  subgraph placing["05–06 · Placing it — here"]
    direction TB
    F["One modal,<br/>one row per hole"]
    G["resolveTemplateScopes()<br/>answer, else default,<br/>else whole project"]
    F --> G
  end
  A --> C
  D -- "a hole term is there" --> F
  D -- "nothing found" --> X["A copy that reads<br/>the author's own sources,<br/>and asks nobody"]
  G --> H["A copy whose prompts read<br/>what the placer chose"]
  classDef gap stroke-dasharray: 6 4
  class B,X gap`;

export const RESOLUTION_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person placing it
  participant M as Ask modal
  participant S as instantiateTemplate
  participant R as resolveTemplateScopes
  participant D as The new copy
  P->>M: Insert "Incident one-pager"
  M-->>P: One row per hole, each with its current value
  P->>M: evidence → Findings, minus one document
  P->>M: subject_line → "Winter outage"
  M->>S: answers { evidence } · texts { subject_line }
  S->>S: normalizeScope — the difference cannot be said inline,<br/>so it is stored as a bound resourceSets row
  S->>R: body, holes, answers
  R-->>S: every prompt scope settled: the answer, else the hole's default,<br/>else the whole project
  S->>S: fillTemplateAtoms — {subject_line} becomes "Winter outage"
  S->>D: one document, revision 0, no reference back
  D-->>P: prompts ready to generate over the scope you chose`;

export const FORKS: ScopeFork[] = [
  {
    index: "01",
    question: "How does a prompt somebody wrote become a hole somebody answers?",
    recommended:
      "Wire the Scope control that already exists in the prompt inspector. Its options become “Whole project” and “Ask when placed…”; choosing the second names the hole and opens the scope builder to set what it should select by default, and writes { select: \"hole\", name } into the prompt's scope there and then.",
    because:
      "The decision belongs where the author already is, at the prompt, and it stays an explicit choice rather than something a save does behind them. It needs no new modal in the save path, it makes the existing dead control mean something, and every link after it already works — declaredFor finds the term, the ask modal lists it, resolution fills it.",
    alternative:
      "Making a template walks every prompt it found and asks, in one modal, which should become holes and what to call them.",
    cost:
      "Truest to “a hole exists because a prompt asks for one”, but it puts a modal in front of every save, including the saves that want nothing asked, and it asks the question a long way from the prompt it is about."
  },
  {
    index: "02",
    question: "What is a hole made this way called?",
    recommended:
      "The author types the name, the way they type a text hole's name today, with the prompt's first words offered as the default.",
    because:
      "The name is what the person placing the template reads. A generated one — a block id, or source_1 — is stable and meaningless, and the label would have to carry the meaning instead, which is two fields where one would do.",
    alternative: "Slug the prompt's own text, and rename the hole whenever the prompt is edited.",
    cost:
      "Nothing to type, but the name moves under the description and default somebody already wrote, and two prompts that start the same way collide."
  },
  {
    index: "03",
    question: "May two prompts share one hole?",
    recommended: "Yes, and nothing needs building for it — the name is the whole of the identity.",
    because:
      "resolveTemplateScopes substitutes by name and memoises the result, so two prompts naming `evidence` already resolve to the same set from one answer. This has been true since the resolver was written and is covered by its unit tests.",
    alternative: "One hole per prompt, enforced at declaration.",
    cost: "Would forbid the common case — a brief whose three prompts all read the same evidence."
  }
];

/**
 * What can be walked today, in the app, without building anything.
 *
 * This is the honest end-to-end: it starts from a template that already holds a
 * hole rather than from a prompt somebody wrote, because link 04 is open.
 */
export const WALKTHROUGH = [
  {
    index: "01",
    does: "Open the seeded document Winter readiness brief and show its Templates panel.",
    sees: "A name field, Save, and the List of every document template with its hole count."
  },
  {
    index: "02",
    does: "Insert “Incident one-pager”.",
    sees:
      "One modal listing every hole: a scope hole reading its default as a sentence with a Default tag, and a text hole with an empty textarea and a red bar, because Insert is held until it has words."
  },
  {
    index: "03",
    does: "Open the scope hole.",
    sees:
      "The builder, Include and Exclude as tabs, kinds and sets and resources to add From on the left, what is held on the right, and Whole project · Default · Clear along the bottom."
  },
  {
    index: "04",
    does: "Exclude one document, accept, type words into the text hole, and Insert.",
    sees:
      "The rows now read Chosen; the prose lands with the words in place; the prompt's scope in the copy is a single set term pointing at a bound row that holds the difference."
  },
  {
    index: "05",
    does: "Save the document as a template of your own, then press Create hole with the caret in a paragraph.",
    sees:
      "A hole named, described and given default words, its atom dropped where the caret was, and the Holes band listing it above the rule."
  },
  {
    index: "06",
    does: "Write a prompt block into that working copy and save it.",
    sees:
      "The prompt is carried into the template with its generated answer dropped — and **no hole is declared for it**. This is link 04, and it is where the walk stops."
  }
];
