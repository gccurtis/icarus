import type { LifecycleStep, Noun, Refusal, Rule, Verb } from "$development-views/template-reference/types";

export const NOUNS: Noun[] = [
  {
    term: "Template",
    says: "A saved original that belongs to one project: a name, tags, a body, and a list of variables. Every write makes a new revision and keeps the last one as a version.",
    onDisk: "templates (projectId, userId, name, tags, body, variables, revision, lastUsedAt) · templateVersions",
    not: "a resource — it cannot be opened in an editor; its working copy can"
  },
  {
    term: "Body",
    says: "The template's content, in the same shape a document, deck or spreadsheet has. A template of one slide is a deck body holding that slide, its layout, and the theme and styles it is drawn with.",
    onDisk: "TemplateBody: document | slides | spreadsheet",
    not: "a fourth kind — a one-slide template is a deck template afterwards"
  },
  {
    term: "Portable",
    aka: "project-neutral",
    says: "What a body must be to live in a template: nothing in it points at one particular thing in the project. A template turns a value into a function, so the pointers go and the shapes stay.",
    onDisk: "portableBodyOf() strips, bodyOf() refuses what survived wrongly",
    not: "lossless — the save says what it dropped, in words"
  },
  {
    term: "Variable",
    says: "A hole in the body that a prompt's scope names. It carries the name the scope uses, a label, a description, and a default scope. It exists because the body names it.",
    onDisk: "TemplateVariable { name, label, description?, default? }",
    not: "something you type in by hand — nothing in the panels adds or removes one"
  },
  {
    term: "Default scope",
    says: "What a variable selects when nobody says otherwise: everything in the project, particular kinds, or one of the project's named sets. A variable with none means everything in the project.",
    onDisk: "TemplatedResourceSet on the variable",
    not: "an answer — it is what the template suggests, not what one use decided"
  },
  {
    term: "Answer",
    says: "What one person picks for one variable at the moment they insert or use the template. It wins over the default for that copy only.",
    onDisk: "nothing — answers are passed to instantiate and never stored",
    not: "a binding — no row remembers it"
  },
  {
    term: "Working copy",
    aka: "stage",
    says: "The document or deck through which a template is edited: a real resource holding the template's body, plus a row saying which template it stands for and which revision it came from. One per template, shared by everyone in the project.",
    onDisk: "templateStages + an ordinary documents / slideDecks row titled Template · name",
    not: "a use of the template, and not something the project's lists show"
  },
  {
    term: "Resource set",
    says: "A named selection of the project's things: everything, some kinds, named resources, or another set, minus exclusions. Made in Project Overview's Contexts panel.",
    onDisk: "resourceSets (projectId, name, description?, set, revision)",
    not: "a template concept — a prompt's scope, a default and an answer can all name one"
  },
  {
    term: "Revision",
    says: "A counter on the template that every write advances. A save sends the revision it read and is refused as stale if the template moved first.",
    onDisk: "templates.revision, mirrored on the stage as templateRevision",
    not: "a version history you can restore from yet — templateVersions keeps the rows, nothing reads them back"
  }
];

export const VERBS: Verb[] = [
  {
    name: "Save as a template",
    gesture: "Name the open document, deck or current slide in the Templates panel, press Save",
    does: "Copies the body, makes it portable, stores it as a template of this project at revision 1, and opens its working copy in a new tab",
    leaves: "The thing you saved from, untouched — it never learns a template was made from it",
    procedure: "createTemplateFromResource"
  },
  {
    name: "Edit",
    gesture: "Double-click in the library, Edit in the inspector, Edit on a panel row",
    does: "Opens the template's working copy in its editor, making the copy if the project has none yet",
    leaves: "One working copy per template, shared — a second person editing lands in the same one",
    procedure: "openTemplateStage"
  },
  {
    name: "Save",
    gesture: "The Templates panel's header, beside Discard, while a working copy is open",
    does: "Flushes the editor, reads the copy's body, makes it portable, and writes it as the template's next revision",
    leaves: "The working copy open, so saving twice is ordinary",
    procedure: "commitTemplateStage"
  },
  {
    name: "Discard",
    gesture: "The Templates panel, after a confirm",
    does: "Deletes the working copy and everything on it, then closes the tab",
    leaves: "The template at its last saved revision",
    procedure: "discardTemplateStage"
  },
  {
    name: "Insert",
    gesture: "Insert on a row of the Templates panel",
    does: "Asks what each variable should select, then copies the template's saved body into the open resource after the current row or slide, with fresh ids",
    leaves: "An ordinary edit — undo removes it, and later changes to the template never reach it",
    procedure: "insertionOf + runtime.apply"
  },
  {
    name: "Use",
    gesture: "Use in the library's inspector",
    does: "Asks the same way Insert does, then makes a whole new document, deck or spreadsheet from the template and opens it",
    leaves: "A resource with no reference back to the template; the template records that it was used",
    procedure: "instantiateTemplate"
  },
  {
    name: "Delete",
    gesture: "Delete in the library's inspector, after a confirm",
    does: "Removes the template, its versions and its working copy, at the revision the inspector read",
    leaves: "Everything ever made from it, untouched",
    procedure: "removeTemplate"
  }
];

export const LIFECYCLE: LifecycleStep[] = [
  {
    index: "01",
    title: "Make",
    person: "Names the open document, deck or current slide and presses Save",
    client: "Sends the resource id and the name, then opens a new tab straight onto the copy's Templates panel",
    server: "Reads the leader snapshot, makes the body portable, stamps the project, declares the variables the body names, says what it dropped",
    rows: "templates at 1 · templateVersions 1 · templateStages staged at 1 · a scratch row titled Template · name"
  },
  {
    index: "02",
    title: "Open",
    person: "Presses Edit on a template",
    client: "The ordinary editor opens on the scratch resource; the panel shows Save and Discard in its header, then the variables",
    server: "Returns the template's working copy, or writes the body at revision N into a new scratch row and records the stage",
    rows: "Nothing new on a resume; otherwise a stage row and a scratch row at N"
  },
  {
    index: "03",
    title: "Edit",
    person: "Types, moves blocks, changes layouts — alone or beside someone else",
    client: "Runtime ops against the scratch resource, flushed and rebased exactly as for any document",
    server: "Nothing template-shaped: the document and deck capabilities, as usual",
    rows: "The scratch resource's snapshots and change sets move. The template does not."
  },
  {
    index: "04",
    title: "Describe",
    person: "Opens a variable, writes what it stands for, sets its default scope",
    client: "Writes the whole variable list at the revision the panel read; the body is untouched",
    server: "updateTemplate makes revision N+1 and carries the working copy to N+1, so this never makes the next save stale",
    rows: "templates at N+1 · templateVersions N+1 · templateStages staged at N+1"
  },
  {
    index: "05",
    title: "Save",
    person: "Presses Save in the Templates panel",
    client: "await runtime.flush(), then refuses while anything is pending or failed — the server reads the leader snapshot",
    server: "Makes the copy's body portable, validates it, writes revision N+1, moves the stage to N+1, says what was dropped",
    rows: "templates at N+1 · templateVersions N+1 · stage staged at N+1 · the scratch row stays"
  },
  {
    index: "06",
    title: "Insert or Use",
    person: "Answers each variable in one modal, or leaves every default",
    client: "Insert builds ops from the template's saved body with fresh ids and the scopes filled in; Use sends the answers to the server",
    server: "instantiateTemplate resolves the scopes, writes the new resource, and records the template's last use",
    rows: "Ops on the open resource, or a new resource with no reference back"
  },
  {
    index: "07",
    title: "Discard",
    person: "Presses Discard and confirms",
    client: "Flushes, asks, and closes the tab only after the server answers",
    server: "Removes the stage row and the scratch row with its snapshots and change sets",
    rows: "The template keeps its last saved revision; no stage"
  }
];

export const RULES: Rule[] = [
  {
    rule: "A template belongs to one project",
    because: "Its library, its working copy and everyone who may edit it are that project's. Nothing crosses projects."
  },
  {
    rule: "Only the working copy writes a template's body",
    because: "There is no second path, so a template and its copy cannot drift apart and nothing needs to be pulled back."
  },
  {
    rule: "Insert and Use are copies",
    because: "What lands is its own from the first moment. No resource carries a reference to a template, so a later change reaches nothing."
  },
  {
    rule: "A template is portable, inside its project too",
    because: "It turns a value into a function: what pointed at one particular thing is stripped and the variables fill the scopes."
  },
  {
    rule: "Variables are found, not typed",
    because: "A variable exists because a prompt's scope names it. Nothing in the panels adds or removes one."
  },
  {
    rule: "A working copy takes no comments",
    because: "Comments do not travel with a template, so the capability refuses a thread on one and the panels say so."
  },
  {
    rule: "Every write is compare-and-swap",
    because: "A save sends the revision it read; a stale one is refused and the panel re-reads rather than overwriting."
  }
];

export const REFUSALS: Refusal[] = [
  { when: "A template in another project", answer: "not-found", where: "read, update, remove, instantiate, open" },
  { when: "A save whose base revision is behind", answer: "stale", where: "commitTemplateStage, updateTemplate, removeTemplate" },
  { when: "A spreadsheet template asked to open for editing", answer: "unsupported-body", where: "openTemplateStage" },
  { when: "A body naming a variable the template does not declare", answer: "unsupported-body, with the names", where: "instantiateTemplate" },
  { when: "An answer naming a set this project does not hold", answer: "unsupported-body, with the ids", where: "instantiateTemplate" },
  { when: "A variable list that drops a name the body still uses", answer: "variable-in-use, with the names", where: "updateTemplate" },
  { when: "A resource set another set or a template default still names", answer: "in-use, naming which", where: "removeResourceSet" },
  { when: "A comment thread on a working copy", answer: "refused before anything is written", where: "startThread" },
  { when: "A save while the editor still holds unflushed work", answer: "refused in the panel, before the request", where: "the Templates panel" }
];

export const STRIPPED: { item: string; keeps: string }[] = [
  { item: "A formula's id", keeps: "the expression — the atom is drawn unbound until a formula is made for it again" },
  { item: "A prompt's generated output id", keeps: "the prompt, its text and its scope" },
  { item: "Links to people, personas and resources", keeps: "the marked text, and a link to a URL with its note" },
  { item: "Images stored in the project", keeps: "the image block, and an image at a URL" },
  { item: "Scope terms naming a set or particular resources", keeps: "the whole-project and kind terms, and the variables" },
  { item: "Ranges into another spreadsheet, and values that reference a resource", keeps: "the cell, emptied" }
];
