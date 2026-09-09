import type { ChainLink, Decision, ScopeGap } from "$development-views/template-reference/types";

/**
 * The chain from writing a prompt to reading a filled copy, link by link.
 *
 * Every link carries now. The one that never existed — turning a prompt
 * somebody wrote into a hole somebody answers — is link 04, and it is built
 * the way the rest of this work is built: found rather than declared, with a
 * name offered rather than demanded, so a template made without a thought
 * still asks the right question.
 */
export const CHAIN: ChainLink[] = [
  {
    index: "01",
    step: "A prompt is written into a document or a slide",
    gesture: "Convert a text box or an empty line, type what it should derive",
    runs: "The prompt-block inspector · createDerivedOutput on Generate",
    state: "works",
    evidence: "template-features.spec.ts — a prompt written in a document becomes a hole"
  },
  {
    index: "02",
    step: "The prompt says what its hole is called and what it stands for",
    gesture: "The Template section in the prompt's own inspector",
    runs: "promptHoleOps writes { name, description } onto the block",
    state: "works",
    evidence: "prompt-holes.test.ts — what a prompt is called"
  },
  {
    index: "03",
    step: "The prompt says what it reads, which is also its hole's default",
    gesture: "Set default context, which opens the scope builder",
    runs: "promptScopeOps · defaultScopeOf decides whether the scope can carry over",
    state: "works",
    evidence: "prompt-holes.test.ts — what a hole selects when nobody says otherwise"
  },
  {
    index: "04",
    step: "Making a template turns every prompt into a hole",
    gesture: "None — it is what saving means",
    runs: "promptHolesOf · withAsks · portableBodyOf · withPromptHoles · mergedPromptHoles",
    state: "works",
    evidence: "answers.test.ts — turns an authored prompt scope into a hole that keeps it as the default"
  },
  {
    index: "05",
    step: "Placing the template asks about each hole, one at a time",
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
    step: "The copy's prompts generate against what was chosen",
    gesture: "Press Generate in the copy",
    runs: "The base's derived-output runtime, over the scope this branch resolved",
    state: "works",
    evidence: "Follows from 06: the copy is an ordinary resource holding ordinary prompt blocks"
  }
];

export const CHAIN_DIAGRAM = `flowchart LR
  subgraph authoring["01–03 · Authoring"]
    direction TB
    A["A prompt block"]
    B["Template section<br/>name · description"]
    C["Default context<br/>whole project, kinds, or nothing"]
    B --> A
    C --> A
  end
  subgraph making["04 · Making a template"]
    direction TB
    D["promptHolesOf<br/>one hole per prompt"]
    E["withAsks<br/>copies the question onto the block"]
    F["withPromptHoles<br/>each scope becomes its hole term"]
    D --> E --> F
  end
  subgraph placing["05–06 · Placing it"]
    direction TB
    G["One hole at a time,<br/>tabs saying which are red"]
    H["resolveTemplateScopes<br/>answer, else default,<br/>else whole project"]
    G --> H
  end
  A --> D
  F --> G
  H --> I["A copy whose prompts read<br/>what the placer chose"]`;

export const RESOLUTION_DIAGRAM = `sequenceDiagram
  autonumber
  participant P as Person placing it
  participant M as Ask modal
  participant S as instantiateTemplate
  participant R as resolveTemplateScopes
  participant D as The new copy
  P->>M: Insert "Incident one-pager"
  M-->>P: A tab per hole — red ones still need words
  M-->>P: winter_sources — its description, its prompt, its default
  P->>M: winter_sources → Findings, minus one document
  P->>M: subject_line → "Winter outage"
  M->>S: answers { winter_sources } · texts { subject_line }
  S->>S: normalizeScope — the difference cannot be said inline,<br/>so it is stored as a bound resourceSets row
  S->>R: body, holes, answers
  R-->>S: every prompt scope settled: the answer, else the hole's default,<br/>else the whole project
  S->>S: fillTemplateAtoms — {subject_line} becomes "Winter outage"
  S->>D: one document, revision 0, no reference back
  D-->>P: prompts ready to generate over the scope you chose`;

export const DEFAULT_RULE = [
  {
    scope: "Nothing set",
    carries: "Everything in the project",
    because: "It is what the prompt reads and what its own inspector says it reads."
  },
  {
    scope: "Everything in the project",
    carries: "Everything in the project",
    because: "Anybody could have meant it, so it means the same thing in the next project."
  },
  {
    scope: "Whole kinds — all documents, all findings",
    carries: "Those kinds",
    because: "A kind is a word about the world, not a row in this project's tables."
  },
  {
    scope: "One of the project's named sets",
    carries: "Nothing — the hole arrives empty",
    because: "The set was true of the project it was written in. Saying it again elsewhere would be a guess."
  },
  {
    scope: "Particular resources, or anything with an exclusion",
    carries: "Nothing — the hole arrives empty",
    because: "The same, and more so: those rows may not exist wherever the template lands."
  }
];

export const SETTLED: Decision[] = [
  {
    round: "This round",
    question: "How does a prompt somebody wrote become a hole somebody answers?",
    answer: "Every prompt is a hole. There is no declaring and no opting in.",
    became:
      "promptHolesOf reads one hole per prompt at save time. A template made from a document full of prompts asks about all of them, whether or not anybody opened the Template section."
  },
  {
    round: "This round",
    question: "What is a hole made this way called?",
    answer: "Prompt 1, Prompt 2, Prompt 3 — offered, and typed over when it matters.",
    became:
      "offeredHoleName by document order, shown in the Template section as the standing value. Typing a name replaces it; blanking it brings the offer back, because a hole with no name cannot be asked about."
  },
  {
    round: "This round",
    question: "Which scopes survive as a hole's default?",
    answer: "The ones anybody could have meant: the whole project, and whole kinds.",
    became:
      "defaultScopeOf, and a hole with no default is the only thing besides empty words that can hold a placement up."
  },
  {
    round: "This round",
    question: "May two prompts share one hole?",
    answer: "Yes, by carrying the same name. Nothing enforces it either way.",
    became:
      "A name is the whole of a hole's identity, and resolveTemplateScopes already memoises by name. Two prompts named the same resolve from one answer; nothing checks, because there is nothing to check."
  },
  {
    round: "This round",
    question: "How does placing a template read, now that a template can hold a dozen holes?",
    answer: "One at a time, with tabs for the shape and a way to blaze through.",
    became:
      "The ask modal walks: name, description, the prompt itself, then the control. Tabs carry a red mark for a hole that still needs words, and Accept all defaults lights up the moment none do."
  }
];

export const LIMITS: ScopeGap[] = [
  {
    title: "A hole's prompt is a snapshot",
    detail:
      "The words shown when placing a template are copied onto the block when the template is made, because the template leaves the derived output behind. Editing the prompt in the original afterwards does not reach the template — saving the template again does.",
    order: "Correct as long as a template is a copy, which is the whole model. Nothing to do."
  },
  {
    title: "A copy's prompts arrive unlinked",
    detail:
      "The template carries the question, so the copy's prompt inspector opens with the words already in it — but the copy has no derived output until somebody presses Generate. That is one press, not a retype.",
    order: "Watch whether people expect a copy to generate on arrival. Nothing suggests they do yet."
  },
  {
    title: "The prompt inspector's old Scope control still says one thing",
    detail:
      "The base's Scope select offers “Whole project” alone and writes nothing. Set default context, beside it in the Template section, is what actually writes a scope — so there are two controls where one would do.",
    order: "Fold the select into the Template section when the base is ready to lose it."
  }
];
