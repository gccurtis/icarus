import type { Defect, Divergence, Reconciliation } from "$development-views/template-reference/types";

/** The branch this work now sits on, and the one it used to sit on. */
export const MEETING = {
  branch: "work/template-features",
  base: "work/derived-output-architecture",
  baseHead: "1166f8e",
  baseAhead: 21,
  mainHead: "306e308",
  branchPoint: "4c1535c",
  commits: 5,
  rebases: 5,
  conflicted: 5,
  events: 6
};

export const TOPOLOGY = `gitGraph
  commit id: "4c1535c" tag: "branch point"
  branch work/derived-output-architecture
  checkout work/derived-output-architecture
  commit id: "semantic overlay"
  commit id: "derived outputs"
  commit id: "prompt blocks"
  commit id: "1166f8e"
  branch work/template-features
  checkout work/template-features
  commit id: "the template system"
  commit id: "the scope builder"
  commit id: "one list of holes"
  commit id: "one row per term"
  commit id: "holes, and Create hole"`;

export const RECONCILED: Reconciliation[] = [
  {
    index: "01",
    path: "capabilities/templates/api/instantiate-template/instantiate-template.ts",
    when: "Onto main, before the move",
    base: "Normalized a document's styles and readied a deck before the leader snapshot was written, both inside the same block this branch had rewritten.",
    branch: "Resolved every prompt scope through the caller's answers and the holes' defaults, then wrote the snapshot.",
    kept: "Both. The style normalisation and the deck readying run where the base put them, the scope resolution runs before them, and the deck branch took the base's destructuring rather than keeping two spellings of the same read.",
    why: "Neither side was making a claim about the other. One prepares a body to be stored; the other decides what the body says. Ordering them was the whole decision."
  },
  {
    index: "02",
    path: "capabilities/templates/test/unit/templates.test.ts",
    when: "Onto main, before the move",
    base: "Asserted that instantiating readies the deck it makes.",
    branch: "Asserted that instantiating stamps lastUsedAt and that the copy carries no template id.",
    kept: "One test with both sets of assertions, in the order the code performs them.",
    why: "Two tests over one call, written against the same fixture, is the same test twice. Merging them keeps the fixture honest and makes a later break point at one place."
  },
  {
    index: "03",
    path: "app-views/categories/slide-deck-editor/slide-deck-editor.md",
    when: "Twice — onto main, then onto the base",
    base: "First cut the document from 714 lines to 221 and listed Templates as a deferred placeholder; later added a Prompts section describing the Prompt Block and how a text box converts into one.",
    branch: "Described the Templates panel — the working copy, the Holes band, the List — in the same place, directly after Comments.",
    kept: "The base's rewrite whole, both times, with the Templates section written again beside Prompts in the base's terse register.",
    why: "A document is prose, so a three-way merge has nothing structural to work with and both sides had rewritten the same neighbourhood. Taking one side whole and re-adding the other by hand is the only way to end with a document that reads."
  },
  {
    index: "04",
    path: "test/browser/document-editor.spec.ts",
    when: "Onto the base",
    base: "Pulled Prompts out of the loop that clicks each context view, to assert the new panel's empty state on its own.",
    branch: "Pulled Templates out of the same loop, for the same reason.",
    kept: "The loop covers Variables alone, and both dedicated blocks stand underneath it.",
    why: "Both sides made the same move for the same reason and git saw one line changed twice. The loop was a convenience for views with nothing to say; two of them now have something to say, so it shrank to the one that does not."
  },
  {
    index: "05",
    path: "app-views/categories/slide-deck-editor/procedures/typing.ts",
    when: "Onto the base",
    base: "Widened the block a person can type into from TextBlock to TextBlock | PromptBlock, and measured an atom as atom.kind === \"literal\" ? atom.text.length : atom.lastResolvedDisplay.length.",
    branch: "Replaced that same measurement with displayOfAtom(atom).length, the shared helper, so a template atom counts as the {name} it draws.",
    kept: "The base's EditableTextBlock union with this branch's shared measurement.",
    why: "This is the only conflict where taking one side would have been a bug. The base's inline measurement has no case for a template atom and would have read `undefined.length`; this branch's narrower type cannot see a Prompt Block at all. Each side needed exactly the half the other had."
  }
];

export const DEFECTS: Defect[] = [
  {
    index: "01",
    title: "A text hole's kind and default words were thrown away on every write",
    symptom:
      "Typing default words into a text hole looked like it worked — the panel showed them — and they were gone on the next read. A text hole could also come back as a scope hole, with a Default scope button where its words had been.",
    cause:
      "updateTemplate rebuilds each hole after normalising its scope, and the rebuild listed name, label, description and default. It was written before text holes existed and nobody widened it when they arrived, so kind and text fell off the object on the way to the store.",
    fix: "The rebuild carries kind and text through, both still omitted rather than written as undefined when they are absent.",
    proof:
      "The browser case that makes a hole with default words now reads both the words and the description back off the card after the round trip, which fails against the old rebuild."
  },
  {
    index: "02",
    title: "The template validator refused a Prompt Block that carried a named style",
    symptom:
      "After the move onto the base, Save deck and Save slide failed outright with “body is not a valid slides template body” — but only in a project where some text box had been converted into a Prompt Block.",
    cause:
      "Converting a text box into a Prompt Block keeps the element's id, frame, paint, order, text, marks, style and format; only the content kind changes. The templates validator lists every key a block may carry and rejects the rest, and its prompt branch had never listed style — the text branch always had.",
    fix: "style joins the prompt branch's key list and is validated as an identifier, exactly as the text branch validates it.",
    proof:
      "The browser case that saves one slide as a deck template. It failed twice in a row before the fix — which is how it was told apart from the known load flake — and passes after it."
  }
];

export const DIVERGENCE: Divergence[] = [
  {
    layer: "Vocabulary",
    base: "The semantic overlay: derived outputs, evidence spans, material profiles, embeddings, and a PromptBlock that carries a derived output id and a generation state.",
    branch:
      "templateStages; templates gains projectId, lastUsedAt and holes; resourceSets gains name and boundTo; TemplatedTerm gains a hole term; Atom gains TemplateAtom; Target gains context.",
    meets:
      "PromptBlock.scope. The base writes prompt blocks; this branch reads their scopes to find holes and substitutes answers back into them."
  },
  {
    layer: "Capabilities",
    base: "derived-output, with grounded synthesis, agent tool rounds, citation and refresh coalescing.",
    branch:
      "templates rewritten as a project subject with working copies, holes and scope normalisation; a new resource-sets capability; startThread refusing a working copy.",
    meets:
      "Nothing calls across. A template is made from a body that already holds prompt blocks, and the generated answer is dropped on the way in."
  },
  {
    layer: "Editors",
    base: "Live Prompt Blocks in both editors: a text box converts in place, a prompt inspector generates and refreshes, a Prompts context panel indexes them.",
    branch:
      "A Templates context panel in both editors: save, open a working copy, the Holes band with Create hole, and the template List.",
    meets:
      "The document and deck bodies, and one shared measurement of an atom's width in `positions.ts`."
  },
  {
    layer: "Components",
    base: "A mermaid diagram component under components/development.",
    branch: "scope-builder and template-answers under components/authored.",
    meets: "These reference pages, which use all three."
  },
  {
    layer: "Evidence",
    base: "Browser cases for prompt blocks in both editors, and live-intelligence cases that skip without a credential.",
    branch: "template-features and template-reference, plus the shared document-editor case both sides edited.",
    meets: "One suite and one seed. 58 cases pass together; 4 skip for want of a key."
  }
];

/** What the base branch needs that this worktree did not have. */
export const PREREQUISITES = [
  {
    what: "app/configuration/local.yaml",
    why: "The base builds an intelligence client at startup and refuses a blank OpenRouter key, so the whole server fails to boot without it. It is git-ignored, so a fresh worktree has none and every browser run dies at `Timed out waiting 120000ms from config.webServer`.",
    how: "Copy it from a checkout that has one. Nothing in the template work reads it."
  },
  {
    what: "mermaid",
    why: "The base added it as a dependency for its own reference pages. A worktree that has not installed since the move renders no diagrams.",
    how: "`pnpm install` runs as part of every scripted check here, so this fixes itself."
  }
];
