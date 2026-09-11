import type { ChainLink, Decision, ScopeGap } from "$development-views/template-reference/types";

/**
 * The chain from making a slot to reading a filled copy.
 *
 * A slot is made, never found. Two things can become one — a prompt, and a run
 * of selected text — and both are turned into slots by the same gesture at the
 * thing itself. Until somebody makes it there is no slot, which is what keeps
 * placing a template to the questions somebody meant to ask.
 */
export const CHAIN: ChainLink[] = [
  {
    index: "01",
    step: "A prompt is written, told what to read, and the agent obeys it",
    gesture: "Convert a block, type the prompt, press Scope to choose its sources",
    runs: "One PromptScope control · the block until it links, the derived output after",
    state: "works",
    evidence: "prompt-blocks.test.ts — linking takes the identity and gives up the scope"
  },
  {
    index: "02",
    step: "Something in a template stage is made into a slot",
    gesture: "Make slot, in the Template section of a prompt or text selection",
    runs: "promptSlotOps writes a record on the block; markSlotOps writes a mark over the run",
    state: "works",
    evidence: "template-features.spec.ts — a template-stage text slot appears immediately"
  },
  {
    index: "03",
    step: "The slot is named and, if it helps, described",
    gesture: "The Slots panel holds metadata; the editor assigns the next sequential name",
    runs: "Slot 1, Slot 2 by what the body already holds",
    state: "works",
    evidence: "prompt-slots.test.ts — a slot is made, never found"
  },
  {
    index: "04",
    step: "Making a template keeps exactly those slots",
    gesture: "None — it is what saving means",
    runs: "promptSlotsOf · withPrompts · portableBodyOf · withPromptSlots · withMarkedSlots · textSlotsOf",
    state: "works",
    evidence: "answers.test.ts — gives no slot to a prompt that was not made into one"
  },
  {
    index: "05",
    step: "Placing it asks about each slot, one at a time",
    gesture: "Insert or Use · tabs, Previous and Next, Accept all defaults",
    runs: "answerRowsOf · promptWordsIn · the scope builder · normalizeScope",
    state: "works",
    evidence: "template-features.spec.ts — inserting a template asks for each slot"
  },
  {
    index: "06",
    step: "The copy reads what was chosen",
    gesture: "None — it is already true of the resource that lands",
    runs: "resolveTemplateScopes substitutes each slot term; fillTemplateAtoms fills each text slot",
    state: "works",
    evidence: "template-features.spec.ts — a slot's default is built with an exclusion and read back"
  },
  {
    index: "07",
    step: "The copy's prompts are prompts, not words about prompts",
    gesture: "Press Generate",
    runs: "withFreshOutputs makes a derived output per prompt from the question the template carried",
    state: "works",
    evidence: "answers.test.ts — a placed presentation's prompts get a derived output with a slides origin"
  },
  {
    index: "08",
    step: "The copy is material the project can find",
    gesture: "None — it is true of the resource that lands",
    runs: "enqueueSemanticSync on the new document, presentation or spreadsheet",
    state: "works",
    evidence: "answers.test.ts — enqueues the copy for retrieval"
  }
];

export const CHAIN_DIAGRAM = `flowchart LR
  subgraph authoring["01–03 · Authoring"]
    direction TB
    A["A prompt block<br/>with a scope it reads"]
    T["A run of selected text"]
    M{{"Make slot"}}
    A --> M
    T --> M
  end
  subgraph making["04 · Making a template"]
    direction TB
    D["promptSlotsOf · textSlotsOf<br/>only declared slots"]
    E["withPrompts<br/>copies the prompt onto the block"]
    F["withPromptSlots<br/>those scopes become slot terms"]
    D --> E --> F
  end
  subgraph placing["05–07 · Placing it"]
    direction TB
    G["One slot at a time"]
    H["resolveTemplateScopes<br/>answer, else the default"]
    I["withFreshOutputs<br/>a derived output per prompt"]
    N["enqueueSemanticSync<br/>the copy is material now"]
    G --> H --> I --> N
  end
  M --> D
  A -. "not made a slot" .-> K["Stays what it is,<br/>and is never asked about"]
  F --> G
  N --> J["A copy whose prompts read<br/>what the placer chose,<br/>and that the project can find"]
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
  M-->>P: A tab per slot — only what the template declares
  M-->>P: winter_sources — its description, its prompt, its default
  P->>M: winter_sources → Findings, minus one document
  M->>S: answers { winter_sources }
  S->>S: normalizeScope — the difference cannot be said inline,<br/>so it is stored as a bound resourceSets row
  S->>R: body, slots, answers
  R-->>S: every slot term settled: the answer, else the default
  S->>S: withFreshOutputs — one derived output per prompt,<br/>from the question the template carried
  S->>D: one document, revision 0, no reference back
  S->>S: enqueueSemanticSync — the copy is the project's material now
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
    carries: "The same rule, stored as a row the slot owns",
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
    question: "Is a slot found or made?",
    answer: "Made. Use Make slot on the thing inside its template stage.",
    became:
      "Ordinary resources have no slot control. A prompt in a template stage produces no slot until somebody presses Make slot."
  },
  {
    round: "This round",
    question: "What can become one?",
    answer: "A prompt block, and a run of selected text — in a document and on a slide alike, by the same gesture.",
    became:
      "The Template section appears in both editors' prompt and text-selection inspectors only for a template stage."
  },
  {
    round: "This round",
    question: "What does making a text slot do to the stage?",
    answer: "It marks where a slot goes without changing the words.",
    became:
      "A text slot is an ordinary mark, addressed like a comment or a link. The words, the formatting and the display are exactly what they were, and withMarkedSlots turns each marked run into its atom only on the copy the template is built from."
  },
  {
    round: "This round",
    question: "What is it called?",
    answer: "Slot 1, Slot 2 — assigned in sequence.",
    became: "nextSlotName counts across every slot the body already holds, whichever kind it is."
  },
  {
    round: "This round",
    question: "What is its default?",
    answer: "Whatever the thing already is. There is no default control.",
    became:
      "A prompt's slot defaults to the scope it reads; a text slot defaults to the words that were selected. Changing a default means changing the thing, where the thing is."
  },
  {
    round: "This round",
    question: "What happens to a prompt's derived output?",
    answer: "The template carries the definition and drops the row, like a formula.",
    became:
      "withPrompts copies the prompt onto the block while the link still exists, and withFreshOutputs makes a derived output per prompt when the template is placed."
  },
  {
    round: "This round",
    question: "May two prompts share one slot?",
    answer: "Yes, by carrying the same name. Nothing enforces it either way.",
    became:
      "A name is the whole of a slot's identity, and resolveTemplateScopes memoises by name. The editor assigns a fresh sequential name to each new slot."
  }
];

export const LIMITS: ScopeGap[] = [
  {
    title: "A mark that reaches into a slot is dropped — on the copy",
    detail:
      "In the template, a bold run that crossed a slot's edge is gone: those words are a question now, and formatting a question means nothing. Every other mark keeps exactly the words it covered, mapped by position. The resource itself keeps all of them.",
    order: "Settled. This is the only thing templating drops, and it drops it where it is harmless."
  },
  {
    title: "A prompt's definition is copied into the template when the template is made",
    detail:
      "A prompt's words and the scope it reads both live on the derived output it is linked to, and a template leaves that row behind. So both are copied onto the block on the way in, and a copy made later gets a derived output of its own built from them. Editing the prompt in the original afterwards does not reach the template — saving the template again does.",
    order: "Correct as long as a template is a copy, which is the whole model. Nothing to do."
  },
  {
    title: "A slot cannot span two blocks",
    detail:
      "A mark lives inside one block, so a selection running across a paragraph break marks nothing. Selecting within a paragraph, or a whole one, is what is offered.",
    order: "Worth revisiting only if somebody wants a slot that swallows structure."
  }
];
