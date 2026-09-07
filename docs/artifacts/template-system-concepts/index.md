# Stages, Sets and Variables

Templates were real before this work. What was missing was a way to edit one, a way to say what a
variable selects when nobody says otherwise, and a way to pull a template into something already open.
Those three gaps are what everything below fills. After the second review a template also belongs to
its project, which settled most of what was open.

## Why saving that slide only asked for a name

A variable is not something you invent when you save. It is a hole a prompt has already punched. A
variable exists in a body as a scope term that reads `{ select: "variable", name }`, sitting inside a
prompt block. When you save a slide as a template, the capability walks the saved body and declares
exactly the variable names it finds. Your slide was drawn by hand and has no prompt blocks, so it names
nothing, so nothing is declared. The form asks for a name and Save because there is nothing else it could
honestly ask.

You declare variables in the other direction, and saving now takes you straight there: the new template
opens for editing in a new tab, on its Templates panel, where a variable is added by label, described,
and given its default. Once prompt blocks exist, a prompt picks a name from that list, and from then on
saving a body that uses one declares it automatically. The machinery for the automatic direction is
already in place and unused.

## What is new

Eight things that did not exist as nouns before. Nothing here is a variation on something you already
had, and none of them is a new kind of template.

**A project on every template** — `projectId` on the row. The library is the project's, anyone in it may
edit, save into and delete a template, and nothing crosses projects. `projectId`, `visibleTemplate`.

**Stage** — A scratch document or deck holding a template's body, plus a row saying which template it is
and which revision it came from. The editor cannot tell it from a real resource, which is the whole
point. One per template, shared by everyone in the project; nobody is marked as editing, and the stage is
the only thing that ever writes the template's body. `templateStages`, `openTemplateStage`.

**Default resource set** — What a variable selects unless the caller says otherwise: everything in the
project, particular kinds, or one of the project's named sets. Every variable has one; a variable
declared without one means everything in the project, so a template always resolves. Set through a modal
from the editor's panel or the inspector. `TemplateVariable.default`, `resolveTemplateScopes`.

**The ask** — Inserting or using a template with variables opens one modal listing each variable with
its description and a choice whose first option is the default; the others are everything in the
project, each kind, and each named set. The choices become answers, which win over the defaults for that
one copy and are stored nowhere. `answerOptions`, `answersFrom`.

**Resource set as a subject** — The table and its two rows already existed and nothing could read them.
Now a capability owns them, resolves what each one currently selects, and refuses to delete one another
set or a template default still names. Project Overview's Contexts panel makes and changes them.
`capabilities/resource-sets`.

**Making a body portable** — Before, portability was only ever checked, so a live document could be
refused but never converted. Now a live body can be stripped of what cannot travel, and the save tells
you each thing it dropped. A template turns a value into a function, so this holds inside one project
too: a formula keeps its expression and loses its instance, drawn as unbound until a formula is made for
it again. `portableBodyOf`.

**Insert** — A template used inside what is already open, rather than only as a whole new resource. Rows
or slides land after the cursor with every id minted fresh, missing styles and layouts come with them,
and prompt scopes arrive filled from the answers, then the defaults. What lands is a copy; later changes
to the template never reach it. `withFreshIds`, `procedures/templating`.

**A template of one slide** — Save slide copies the current slide into a deck template holding that
slide, its layout, and the theme and styles it is drawn with, and no sections. It is not a fourth kind:
afterwards it is a deck template like any other, listed, inserted and edited the same way. `deckOfSlide`.

## What changed about the templates you already had

| Concept | State | What is different |
| --- | --- | --- |
| Template body | unchanged | Document, deck, or spreadsheet, as before. A template of one slide is a deck body with one slide in it. |
| Who a template belongs to | changed | Was a person's. Now the project's: `projectId` is required, the library lists the project's templates, and anyone in the project may edit, save into and delete one. `userId` stays as a record of who made it. |
| Template variable | changed | Its shape is main's shape: name, label, description, default. The list is editable from the editor, each default is set through a modal, and a default may name one of the project's sets. |
| Scope resolution | changed | Takes the caller's answers first, then each variable's default, then everything in the project. Only a name the template never declared refuses. |
| Instantiate | changed | Takes answers from the caller, else the default; Insert and Use both ask for them in one modal. The resource it makes carries no reference to the template; the template records its own last use. |
| Update | changed | Can replace the variable list, and carries the template's stage to the revision it makes, so a variable declared mid-edit never makes the next save stale. No owner check. |
| Delete | changed | Removes the template with its versions and its working copy and touches no resource, because none refers back. No owner check. |
| Provenance on resources | removed | Main's `templateId` on documents, decks and spreadsheets is gone: a resource made from a template is a copy and knows nothing of where it came from. |
| Comments | changed | A thread cannot be started on a template's working copy; the comments capability refuses it and the deck's comment panels say so. Comments never travel with a template. |
| Project resource list | changed | Skips any resource a stage occupies, so a scratch copy never shows up in Overview, in recents, or in a comment's picker. |
| Library and inspector | changed | Edit beside Use, double-click to edit, and on each variable its description then a Default button that opens the modal, named sets included. Every row says Project; nobody is marked as editing. |
| Versions and revisions | unchanged | Same compare-and-swap discipline and the same version row on every write. |

## Where a variable comes from

1. **Name it and save.** The body is copied and made portable. Any variable name the body already uses
   is declared for you, with the name as its label. The new template opens for editing in a new tab.
   Today this declares nothing, because nothing in a hand-drawn body names a variable yet.
2. **You are now editing the template.** The tab is the ordinary editor on a scratch copy titled
   `Template · <name>`; the Templates panel shows *Save to template* and *Discard* in place of the name
   field. Edit in the library, the inspector, or a panel row to come back to the same copy later; anyone
   in the project who opens it lands on the same one.
3. **Declare the variable.** Type a label into the Variables band and press Add. The name is derived from
   the label and made unique; a description sits first under the variable, saying what it stands for.
4. **Set its default.** Under the description, *Default* and a button reading the current rule as a
   sentence. The button opens a modal: everything in the project, particular kinds, or one of the
   project's named sets such as *Winter filings*. There is always a default; everything in the project is
   the default of defaults.
5. **Someone inserts or uses the template.** A modal lists the variable with its default first; they
   keep it or pick something else for this one copy. What lands is theirs and carries no reference back.

The sixth step is the one you have not built: a prompt block picks a name off that list. When it does,
nothing here changes, and step one starts declaring variables on its own.

## The names you saw on screen

- **Everything in the project** — the sentence a default reads as when it selects the whole project. It
  is what every variable starts with, and the first switch in the modal.
- **Winter filings · Field evidence** — the two seeded resource sets, made and changed in Project
  Overview's Contexts panel. A default can name either, and so can an answer in the Insert modal.
- **Findings** — one of the five resource kinds a set or a default can select, alongside documents,
  decks, spreadsheets and research threads. An existing kind, not a new one.
- **Template · Operational readiness brief** — the title of a stage's tab: the template's name, so the
  strip says what is open. The copy never appears in the project's own lists.

## Left open

Three reviews settled the project binding, the shared stage, the ask on Insert and Use, the stripping
that stays inside one project, comments refused on a working copy, and the end of provenance on
resources; the *Template Stage Flow* artifact records each answer and what it became, and the *Template
Dictionary* defines every word. Two small forks remain, both built the recommended way: where resource
sets are managed, and whether a deck insert brings layouts.

Deliberately not built: prompt blocks picking a variable (the feature this was built to receive);
retroactively deriving variables from a prompt's existing dependencies; staging a spreadsheet, which has
no editor to open it in; storing images with a template so they travel; making a formula instance for a
neutral formula atom when a copy lands, which needs a formula system main does not have yet.

Worktree `.claude/worktrees/template-features` · branch `work/template-features` from main `7739f04` ·
uncommitted.
