import type { Decision, OpenItem, SystematicChange, Verification } from "$development-views/template-reference/types";

export const SYSTEMATIC: SystematicChange[] = [
  {
    index: "01",
    title: "A template belongs to a project",
    before: "A template had an owner and no project. The library listed what the viewer owned; update, delete and save were owner-only.",
    now: "templates.projectId is required. Visibility, editing, saving and deletion are the project's; userId records who made it and grants nothing. Every library row reads Project.",
    why: "Templates are the project's material. The owner-only refusals were the only thing making a shared library impossible.",
    area: "templates"
  },
  {
    index: "02",
    title: "A template is edited through a working copy",
    before: "The templates category had an editor door that printed the session record it was waiting for. A template's body could not be changed at all.",
    now: "openTemplateStage writes the body into a scratch document or deck and records a templateStages row; the ordinary editor opens on it; the panel's Save writes it back as the next revision; Discard removes it.",
    why: "The editors work on documents and decks, not on templates. A copy that is an ordinary resource needs no new editor, no new runtime and no new surface.",
    area: "templates"
  },
  {
    index: "03",
    title: "One working copy, shared, and it is the only writer",
    before: "Nothing existed to share. The first pass tracked a copy per person and drew an editing mark.",
    now: "One stage per template, keyed by template and project. Two people editing land in the same copy and collaborate through the editor's own sync. Nothing records who is editing.",
    why: "This is a multi-user application: the editors already reconcile concurrent sessions on one resource. Because the copy is the only writer of the body, a template and its copy cannot drift.",
    area: "templates"
  },
  {
    index: "04",
    title: "Holes are found, described and scoped",
    before: "A hole was fixed at seed time with a portable default and no way to change it.",
    now: "Saving or committing declares every hole name the body's prompt scopes use. The panels show them read-only, with a description and a default scope set through a modal — everything in the project, kinds, or one of the project's sets.",
    why: "A hole exists because a prompt asks for one. Typing a name that no prompt uses would be a hole nothing fills.",
    area: "templates"
  },
  {
    index: "05",
    title: "Placing a template asks what its holes select",
    before: "Instantiate resolved from the stored defaults and had no way to be told anything.",
    now: "Insert and Use open one modal listing every hole, its description, and a choice whose first option is the default. The answers win for that copy and are stored nowhere.",
    why: "Instantiating on its own and instantiating inside something else are the same act. Inserting into a template being edited is the exception: it keeps the holes and merges the holes.",
    area: "editors"
  },
  {
    index: "06",
    title: "Resource sets became a subject",
    before: "The resourceSets table existed, was seeded with two rows, and no capability read or wrote it.",
    now: "A resource-sets capability of four procedures, and a Contexts panel in Project Overview that makes, renames, changes and deletes sets and counts what each one selects right now.",
    why: "A prompt's scope, a hole's default and an answer can all name a set. Nothing could say what a set meant.",
    area: "sets"
  },
  {
    index: "07",
    title: "A template of one slide",
    before: "A deck template was the whole deck.",
    now: "Save slide copies the current slide, its layout, and the deck's theme and styles into a deck template holding that slide alone.",
    why: "A slide-sized template needed no fourth body kind: everything that draws, validates, stages and inserts a deck already works on it.",
    area: "templates"
  },
  {
    index: "08",
    title: "Nothing points back at a template",
    before: "documents, slideDecks and spreadsheets carried a templateId, deletion detached it, and the library derived recency by joining through it.",
    now: "The field is gone. A resource made from a template is a copy that knows nothing of where it came from; the template records its own lastUsedAt, which is what recency reads.",
    why: "Saving a resource as a template is a copy, and making a resource from a template is a copy. Neither side should know about the other.",
    area: "templates"
  },
  {
    index: "09",
    title: "Comments do not travel, and cannot be started on a copy",
    before: "A working copy was an ordinary resource, so it took comment threads like any other.",
    now: "startThread reads the stage table and refuses a target one of its rows names; both deck comment panels replace their composer with the reason.",
    why: "If links, images and formula bindings are stripped, a comment — which can mention a person — is one more thing that must not ride along.",
    area: "neighbours"
  },
  {
    index: "10",
    title: "The vocabulary gained one table, one field, one term",
    before: "No representation of a working copy; a templated scope could not name a set; a tab could not be opened onto a named context view.",
    now: "templateStages; a set term on TemplatedTerm; Target.context; and four pure functions under behavior/templates (resolve scopes, make portable, mint fresh ids, take one slide as a deck) plus resource-set resolution.",
    why: "Both processes need the same functions — the capability validates with them, the editors insert with them — and behavior is where a lint rule keeps them free of clocks, randomness and stores.",
    area: "vocabulary"
  },
  {
    index: "11",
    title: "A panel section waits a tick before it discloses",
    before: "A section that started open mounted its body in the tick that mounted its heading, and tearing that panel down left the disclosure primitive reading a derived from the destroyed tick.",
    now: "PanelSection mounts the body once the heading has settled, so switching away from a panel holding an open section no longer warns.",
    why: "The Templates panel is the first panel whose open section is switched away from under test, and every browser specification fails on a console warning.",
    area: "cross-cutting"
  },
  {
    index: "12",
    title: "A scope is built rather than picked",
    before:
      "A hole's default and an answer were a short list of toggles: everything, some kinds, or one of the project's named sets. Nothing could exclude anything, and nothing could name a particular resource.",
    now: "One builder, opened from four places, with two term lists and a live count. A rule that excludes something or names resources is stored as a resourceSets row with no name, bound to the hole that owns it, and what points at it is a single set term.",
    why: "Resolving a template substitutes one term for what fills it, on either side of a prompt's scope, and a difference cannot be substituted on the excluding side. The row is what makes exclusions expressible at all.",
    area: "sets"
  },
  {
    index: "13",
    title: "A template asks for words as well as for resources",
    before:
      "A template's only empty place was a prompt's scope. Prose was fixed: a template that wanted a subject line, a client name or a date had to be edited after it was placed.",
    now: "A template atom is a hole in the prose, declared beside the scope holes and found from the body once it is placed. Placing a template lists every hole as a key and what answers it, opens each one to its description, and refuses while any words are missing.",
    why: "A template is a function and its empty places are its arguments. Whether they select resources or say words, one list is what the person placing it has to fill.",
    area: "vocabulary"
  },
  {
    index: "14",
    title: "A hole is a hole, never a variable",
    before:
      "The empty places a template leaves were called variables, in the types, the tables, the capability, the panels and the seed — the same word this application already uses for a named value a formula reads.",
    now: "TemplateHole, templates.holes, holeCount, holeDescription, hole-in-use, { select: \"hole\" } and a boundTo of kind hole. The Holes band sits above a rule, with Create hole at its top; the formula Variables panel keeps the word it had first.",
    why: "Two unrelated ideas sharing a word is how a vocabulary stops being one. A template's holes have nothing to do with formula variables, so they no longer read as though they do.",
    area: "vocabulary"
  },
  {
    index: "15",
    title: "A text hole is made where it goes",
    before:
      "Every hole was found from the body, so a text hole could only appear by inserting a template that already had one. Nothing in the panel could make a place for words.",
    now: "Create hole, at the top of the Holes band, takes a name, a description and default words, declares the hole and drops its atom at the caret in one act. A scope hole is still found, because a prompt is what asks for one.",
    why: "Only the writer knows where in the prose a hole belongs, so the panel cannot find it. Declaring without placing would leave a hole nothing fills, which is why the two happen together or not at all.",
    area: "editors"
  }
];

export const DECISIONS: Decision[] = [
  {
    round: "First review",
    question: "Should a slide template be its own kind?",
    answer: "No. A slide or a set of slides just becomes a slide deck.",
    became: "deckOfSlide() makes a deck body with one slide; the slide body kind, its validation and its panel toggles were deleted."
  },
  {
    round: "First review",
    question: "Where does a hole's meaning live?",
    answer: "In a default that always exists — everything in the project unless the template says otherwise. There is no binding.",
    became: "TemplateHole.default, the modal that sets it, and the removal of the per-project binding table and its procedure."
  },
  {
    round: "First review",
    question: "Should we track who is editing a template?",
    answer: "No — this is a multi-user application and the editors manage the save between them.",
    became: "One shared stage per template; no viewer field, no editing mark; the panel and library say nothing about who is in it."
  },
  {
    round: "Second review",
    question: "Are templates bound to the project?",
    answer: "Yes, and those are the only templates we care about for now.",
    became: "templates.projectId, project-scoped visibility, no owner-only refusals, and a default that may name one of the project's sets."
  },
  {
    round: "Second review",
    question: "Should saving keep the working copy open?",
    answer: "Keep it simple: saving updates the template and the copy stays.",
    became: "commitTemplateStage leaves the stage; the copy is closed only by Discard."
  },
  {
    round: "Third review",
    question: "Does a copy inside its own project still drop links, images and set scopes?",
    answer: "Yes. A template converts a value into a function, so the constraints do not change with where it lives.",
    became: "The stripping stands, the reasons are written down, and an unbound formula atom keeps its expression and is drawn as project-neutral in the editor."
  },
  {
    round: "Third review",
    question: "Should Use ask for holes the way Insert does?",
    answer: "Yes — instantiating on its own or inside something else is still instantiating.",
    became: "The library inspector's Use opens the same modal and sends the answers to instantiateTemplate."
  },
  {
    round: "Third review",
    question: "Can a person add or remove a hole?",
    answer: "No. Holes come from prompt blocks; adding one by hand asks the author to keep a list in step with a body.",
    became: "The Add field and the Remove button are gone from both panels, and the helpers that minted names were deleted with them."
  },
  {
    round: "Third review",
    question: "Should a resource point at the template it came from?",
    answer: "No. Making a template and using one are both copies; neither side should know about the other.",
    became: "templateId removed from documents, slideDecks and spreadsheets and from the seed; templates.lastUsedAt records use instead."
  },
  {
    round: "Third review",
    question: "Are comments allowed on a working copy?",
    answer: "No — if the rest is stripped, comments are stripped too.",
    became: "startThread refuses a stage target; the deck's two comment panels say so where the composer would be."
  }
];

export const VERIFICATION: Verification[] = [
  { check: "Types", command: "pnpm typecheck", result: "0 errors, 0 warnings across 2,915 files", clean: true },
  { check: "Structure", command: "pnpm lint", result: "56 checks, 56 clean", clean: true },
  { check: "Unit", command: "pnpm test", result: "1,032 tests in 116 files, 2 skipped", clean: true },
  { check: "Category keys", command: "pnpm category-keys -- --check", result: "10 categories and 13 content views in step", clean: true },
  {
    check: "Browser",
    command: "pnpm test:browser, from a clean seed",
    result: "60 of 60, with 4 skipped — the live-intelligence cases the base branch skips when no credential is configured.",
    clean: true
  }
];

export const OPEN: OpenItem[] = [
  {
    title: "Holes from the prompt blocks this branch now sits on",
    detail:
      "The base branch has live prompt blocks in both editors, so a scope hole can finally come from a prompt somebody wrote rather than only from an inserted template. Nothing here has been taught to read them yet: a hole still appears when a body already carries a { select: \"hole\" } scope. The agreed shape is pull-based — making a template walks the prompts it found and asks what each one's scope should be, and two prompts may point at the same hole.",
    recommendation: "Build it against the prompt block that now exists, as the next piece of work."
  },
  {
    title: "Images stored with a template",
    detail: "An image stored in the project is dropped when a body becomes portable, so a template cannot carry one.",
    recommendation: "Store the file with the template so it travels; the strip list already names this as the item most likely to change."
  },
  {
    title: "Binding a project-neutral formula",
    detail: "A formula atom in a template keeps its expression and has no formulaId; the editor draws it unbound. Nothing makes a new formula instance for it when a copy lands.",
    recommendation: "Belongs to the formula system, which the base does not have yet."
  },
  {
    title: "Where resource sets are managed",
    detail: "Sets are made and changed in Project Overview's Contexts panel, which the rail already named.",
    recommendation: "Keep it there until a set needs a screen of its own."
  },
  {
    title: "Inserting a deck template brings layouts",
    detail: "A deck insert brings any layout and style key the deck lacks, with the deck's own version winning where both have one.",
    recommendation: "Keep it — a slide without its layout draws wrong."
  },
  {
    title: "A spreadsheet template cannot be opened",
    detail: "There is no spreadsheet editor to open a working copy in, so the stage target excludes it and the library says why.",
    recommendation: "Nothing to decide until that editor lands."
  }
];

export const MERGE = {
  base: "1166f8e",
  commits: 43,
  mainFiles: 432,
  overlap: [
    "app/seed/templates.json",
    "app/seed/templateVersions.json",
    "app/src/lib/app-views/categories/document-editor/content/document.svelte",
    "app/src/lib/app-views/categories/document-editor/procedures/projection.ts",
    "app/src/lib/app-views/categories/document-editor/procedures/schema.ts",
    "app/src/lib/app-views/categories/slide-deck-editor/context/comments.svelte",
    "app/src/lib/app-views/categories/slide-deck-editor/context/templates.svelte",
    "app/src/lib/app-views/categories/slide-deck-editor/inspector/threads.svelte",
    "app/src/lib/app-views/categories/slide-deck-editor/procedures/scene.ts",
    "app/src/lib/app-views/categories/slide-deck-editor/procedures/typing.ts",
    "app/src/lib/app-views/categories/slide-deck-editor/slide-deck-editor.md",
    "app/src/lib/capabilities/comments/api/start-thread/start-thread.ts",
    "app/src/lib/capabilities/comments/comments.md",
    "app/src/lib/capabilities/comments/test/unit/comments.test.ts",
    "app/src/lib/capabilities/templates/api/instantiate-template/instantiate-template.ts",
    "app/src/lib/capabilities/templates/api/shared/validation.ts",
    "app/src/lib/capabilities/templates/test/unit/templates.test.ts",
    "app/src/lib/development-views/demo/components/demo-index.svelte",
    "app/src/lib/model/client/workspace-state/test/unit/workspace-state.test.ts",
    "app/src/lib/representation/data/behavior/content/positions.ts",
    "app/src/lib/representation/data/behavior/slide-decks/apply-ops.ts",
    "app/src/lib/representation/data/behavior/workspace/opening.ts",
    "app/src/lib/representation/data/types/workspace/tab.ts",
    "app/test/browser/document-editor.spec.ts"
  ],
  conflicts: [
    {
      path: "instantiate-template.ts",
      note: "The base normalizes a document's styles and readies a deck before the leader snapshot is written. Both calls were kept, alongside this branch's scope resolution, and the deck branch took the base's destructuring."
    },
    {
      path: "templates.test.ts",
      note: "The base asserts the readied deck; this branch asserts lastUsedAt and that no copy carries a template id. Both assertions now stand in the same test."
    },
    {
      path: "slide-deck-editor.md",
      note: "The base cut the document from 714 lines to 221 and later added a Prompts section. Its rewrite was taken whole each time, and the Templates panel was described again beside it in the same terse register."
    },
    {
      path: "document-editor.spec.ts",
      note: "Both sides moved one context view out of the same loop to assert it on its own — the base for Prompts, this branch for Templates. The loop now covers Variables alone and both blocks stand under it."
    },
    {
      path: "typing.ts",
      note: "The base taught the deck's typing to edit a Prompt Block; this branch measured atoms through displayOfAtom so a template atom counts. The editable-block type is the base's and the measurement is this branch's."
    }
  ]
};

export const MODEL_DELTA = {
  added: [
    { name: "templateStages", note: "projectId, templateId, templateRevision, target, resourceId, createdBy, updatedAt" },
    { name: "templates.projectId", note: "required — the project a template belongs to" },
    { name: "templates.lastUsedAt", note: "optional — when it was last instantiated, which is what recency reads" },
    { name: "TemplatedTerm { select: \"set\" }", note: "a hole default may name one of the project's sets" },
    { name: "Target.context", note: "a tab can be opened straight onto a named context view" }
  ],
  removed: [
    { name: "documents.templateId", note: "a copy knows nothing of where it came from" },
    { name: "slideDecks.templateId", note: "the same" },
    { name: "spreadsheets.templateId", note: "the same" }
  ],
  unchanged: [
    { name: "TemplateBody", note: "document | slides | spreadsheet, exactly as before" },
    { name: "TemplateHole", note: "name, label, description?, default? — main's shape" },
    { name: "resourceSets", note: "the table was already there; only the capability over it is new" }
  ]
};
