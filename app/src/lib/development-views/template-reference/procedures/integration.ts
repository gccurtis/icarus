import type { ChainLink, Decision, ScopeGap } from "$development-views/template-reference/types";

/**
 * The chain from making a hole to reading a filled copy.
 *
 * A hole is made, never found. Two things can become one — a prompt, and a run
 * of selected text — and both are turned into holes by the same gesture at the
 * thing itself. Until somebody makes it there is no hole, which is what keeps
 * placing a template to the questions somebody meant to ask.
 */
export const CHAIN: ChainLink[] = [
  {
    index: "01",
    step: "A prompt is written, and told what to read",
    gesture: "Convert a block, type the prompt, press Scope to choose its sources",
    runs: "The prompt-block inspector · promptScopeOps · the scope builder",
    state: "works",
    evidence: "document-editor.spec.ts — a Prompt Block affordance lives in the gutter"
  },
  {
    index: "02",
    step: "Something is templateified, and nothing about the resource changes",
    gesture: "Templateify, in the Template section of a prompt or of a text selection",
    runs: "promptHoleOps writes a record on the block; markHoleOps writes a mark over the run",
    state: "works",
    evidence: "template-features.spec.ts — Templateify marks a run without changing the document"
  },
  {
    index: "03",
    step: "The hole is named and, if it helps, described",
    gesture: "Two fields. Blank the name and the offered one comes back",
    runs: "Hole 1, Hole 2 by what the body already holds",
    state: "works",
    evidence: "prompt-holes.test.ts — a hole is made, never found"
  },
  {
    index: "04",
    step: "Making a template keeps exactly those holes",
    gesture: "None — it is what saving means",
    runs: "promptHolesOf · withAsks · portableBodyOf · withPromptHoles · withMarkedHoles · textHolesOf",
    state: "works",
    evidence: "answers.test.ts — gives no hole to a prompt nobody templateified"
  },
  {
    index: "05",
    step: "Placing it asks about each hole, one at a time",
    gesture: "Insert or Use · tabs, Previous and Next, Accept all defaults",
    runs: "answerRowsOf · promptWordsIn · the scope builder · normalizeScope",
    state: "works",
    evidence: "template-features.spec.ts — inserting a template asks for each hole"
  },
  {
    index: "06",
    step: "The copy reads what was chosen",
    gesture: "None — it is already true of the resource that lands",
    runs: "resolveTemplateScopes substitutes each hole term; fillTemplateAtoms fills each text hole",
    state: "works",
    evidence: "template-features.spec.ts — a hole's default is built with an exclusion and read back"
  },
  {
    index: "07",
    step: "The copy's prompts are prompts, not words about prompts",
    gesture: "Press Generate",
    runs: "withFreshOutputs makes a derived output per prompt from the question the template carried",
    state: "works",
    evidence: "The copy's blocks carry derivedOutputId and their scope, the way a formula regains its instance"
  }
];

export const CHAIN_DIAGRAM = `flowchart LR
  subgraph authoring["01–03 · Authoring"]
    direction TB
    A["A prompt block<br/>with a scope it reads"]
    T["A run of selected text"]
    M{{"Templateify"}}
    A --> M
    T --> M
  end
  subgraph making["04 · Making a template"]
    direction TB
    D["promptHolesOf · textHolesOf<br/>only what was templateified"]
    E["withAsks<br/>copies the question onto the block"]
    F["withPromptHoles<br/>those scopes become hole terms"]
    D --> E --> F
  end
  subgraph placing["05–07 · Placing it"]
    direction TB
    G["One hole at a time"]
    H["resolveTemplateScopes<br/>answer, else the default"]
    I["withFreshOutputs<br/>a derived output per prompt"]
    G --> H --> I
  end
  M --> D
  A -. "not templateified" .-> K["Stays what it is,<br/>and is never asked about"]
  F --> G
  I --> J["A copy whose prompts read<br/>what the placer chose"]
  classDef quiet stroke-dasharray: 6 4
  class K quiet`;

export const RESOLUTION_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person placing it
  participant M as Ask modal
  participant S as instantiateTemplate
  participant R as resolveTemplateScopes
  participant D as The new copy
  P->>M: Insert "Incident one-pager"
  M-->>P: A tab per hole — only what somebody templateified
  M-->>P: winter_sources — its description, its prompt, its default
  P->>M: winter_sources → Findings, minus one document
  M->>S: answers { winter_sources }
  S->>S: normalizeScope — the difference cannot be said inline,<br/>so it is stored as a bound resourceSets row
  S->>R: body, holes, answers
  R-->>S: every hole term settled: the answer, else the default
  S->>S: withFreshOutputs — one derived output per prompt,<br/>from the question the template carried
  S->>D: one document, revision 0, no reference back
  D-->>P: prompts linked and ready to generate`;

export const DEFAULT_RULE = [
  {
    scope: "A prompt reading the whole project",
    carries: "The whole project",
    because: "The default is whatever the thing already is. There is no judgement to make."
  },
  {
    scope: "A prompt reading whole kinds",
    carries: "Those kinds",
    because: "The same."
  },
  {
    scope: "A prompt reading one of the project's named sets",
    carries: "That set",
    because:
      "Placed in a project that has no such set, it selects nothing — which is what it means for the set not to exist there."
  },
  {
    scope: "A prompt reading particular resources, or excluding something",
    carries: "The same rule, stored as a row the hole owns",
    because:
      "The templated vocabulary has no term for particular resources, so the rule lives in a resourceSets row and a single set term points at it."
  },
  {
    scope: "A run of selected text",
    carries: "Those words",
    because: "A template placed without changing anything reads exactly like the document it came from."
  }
];

export const SETTLED: Decision[] = [
  {
    round: "This round",
    question: "Is a hole found or made?",
    answer: "Made. Templateify, on the thing itself.",
    became:
      "A prompt keeps its scope and produces no hole until somebody presses the button. Placing a template asks only about what somebody meant to be asked about."
  },
  {
    round: "This round",
    question: "What can become one?",
    answer: "A prompt block, and a run of selected text — in a document and on a slide alike, by the same gesture.",
    became:
      "The Template section appears in both editors' prompt inspectors and in both editors' text-selection inspectors, in the ordinary editor as much as in a working copy."
  },
  {
    round: "This round",
    question: "What does templateifying do to the resource?",
    answer: "Nothing. It marks where a hole goes; it does not put one there.",
    became:
      "A text hole is an ordinary mark, addressed like a comment or a link. The words, the formatting and the display are exactly what they were, and withMarkedHoles turns each marked run into its atom only on the copy the template is built from."
  },
  {
    round: "This round",
    question: "What is it called?",
    answer: "Hole 1, Hole 2 — offered, typed over when it matters.",
    became: "nextHoleName counts across every hole the body already holds, whichever kind it is."
  },
  {
    round: "This round",
    question: "What is its default?",
    answer: "Whatever the thing already is. There is no default control.",
    became:
      "A prompt's hole defaults to the scope it reads; a text hole defaults to the words that were selected. Changing a default means changing the thing, where the thing is."
  },
  {
    round: "This round",
    question: "What happens to a prompt's derived output?",
    answer: "The template carries the definition and drops the row, like a formula.",
    became:
      "withAsks copies the question onto the block while the link still exists, and withFreshOutputs makes a derived output per prompt when the template is placed."
  },
  {
    round: "This round",
    question: "May two prompts share one hole?",
    answer: "Yes, by carrying the same name. Nothing enforces it either way.",
    became:
      "A name is the whole of a hole's identity, and resolveTemplateScopes memoises by name. In practice each templateified thing gets its own."
  }
];

export const LIMITS: ScopeGap[] = [
  {
    title: "A mark that reaches into a hole is dropped — on the copy",
    detail:
      "In the template, a bold run that crossed a hole's edge is gone: those words are a question now, and formatting a question means nothing. Every other mark keeps exactly the words it covered, mapped by position. The resource itself keeps all of them.",
    order: "Settled. This is the only thing templating drops, and it drops it where it is harmless."
  },
  {
    title: "A prompt's text is copied into the template when the template is made",
    detail:
      "A prompt's words live on the derived output it is linked to, and a template leaves that row behind. So the words are copied onto the block on the way in, and a copy made later gets a derived output of its own built from them. Editing the prompt in the original afterwards does not reach the template — saving the template again does.",
    order: "Correct as long as a template is a copy, which is the whole model. Nothing to do."
  },
  {
    title: "A hole cannot span two blocks",
    detail:
      "A mark lives inside one block, so a selection running across a paragraph break marks nothing. Selecting within a paragraph, or a whole one, is what is offered.",
    order: "Worth revisiting only if somebody wants a hole that swallows structure."
  }
];
