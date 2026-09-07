# Template Dictionary

Every word the template work uses, defined once, with what it is on disk and what you see it as. Read
the first section if you only want to know what a stage is.

## 1 · What a stage is, in one story

A template is a saved original that people make copies from. You cannot type into the original
directly, because the editors work on documents and decks, not on templates. So when you press Edit on
a template, the app makes you a **working copy**: a real document or deck that holds the template's
content, opens in the ordinary editor, and is called a **stage** in the code. The stage is the only
thing that can change the original.

1. **You press Edit on "Operational readiness brief."** A new tab opens, titled *Template · Operational
   readiness brief*. It is an ordinary document whose content is the template's. That document, plus a
   small record saying which template it stands for, is the stage.
2. **You edit it like any document.** Typing, styles, layouts, undo. A colleague who presses Edit on
   the same template lands in the same working copy and sees your edits, the way they would in any
   shared document.
3. **You press Save to template.** The working copy's content is copied back into the original as its
   next revision. The working copy stays open, so you can save again.
4. **You press Discard.** The working copy is deleted, together with anything that accumulated on it.
   The original keeps its last saved revision.

That is all a stage is: the one document or deck through which a template is edited. Nobody owns it,
nothing else ever writes the template's content, and it never shows up in the project's list of
documents.

## 2 · Things

**Template** (`templates` · `templateVersions`) — A saved original, belonging to one project: a name,
tags, a body, and a list of variables. Every save makes a new revision and keeps the old one as a
version. On disk: one `templates` row with `projectId`, and a `templateVersions` row per revision. Not a
resource: it cannot be opened in an editor; its working copy can.

**Body** (document · slides · spreadsheet) — The template's content, in the same shape a document,
deck, or spreadsheet has, made portable. A template of one slide is a deck body holding one slide.
Example: Save slide on slide 3 of a deck makes a deck template whose body holds slide 3, its layout,
and the deck's theme and styles.

**Portable** (project-neutral) — What a body must be to live in a template: nothing in it points at a
particular thing in the project. A template turns a value into a function, so the pointers go and the
shapes stay. What goes: the id a formula was bound to (the expression stays); a prompt's generated
output; links to people and resources; images stored in the project; scope terms that name a set or a
resource (the variables fill those). The save tells you each thing it dropped. Example: a formula atom
in a template keeps `=SUM(costs)` and has no `formulaId`; the editor draws it with a dashed outline,
and a new formula is made for it when the copy is bound.

**Variable** (`TemplateVariable`) — A hole in the template that a prompt's scope can name. It has a
name (`lower_snake`, minted from the label), a label, a description, and a default. Example: a brief
template's prompt says "summarise *readiness_record*"; *Readiness record* is the variable, and whoever
inserts the template says what it selects. Not a value: prompt blocks that pick a variable are a later
feature; today variables are declared in the Templates panel.

**Default** (`TemplateVariable.default`) — What a variable selects when nobody says otherwise:
everything in the project, particular kinds, or one of the project's named sets. Every variable has
one; a variable declared without one means everything in the project. Set through a modal from the
editor's Templates panel or the library inspector; read back as a sentence such as "Findings and Winter
filings".

**Answer** (`TemplateAnswers`) — What one person chooses for one variable at the moment they insert or
use a template. It wins over the default for that copy and is stored nowhere. Example: the Insert modal
lists each variable with *Default · Findings* first, then everything in the project, each kind, and
each named set. Leaving every default takes one press.

**Stage** (working copy · `templateStages`) — The document or deck through which a template is edited:
a real resource holding the template's body, plus a row saying which template it stands for and which
revision it was taken from. One per template, shared by everyone in the project. On disk: a
`templateStages` row and an ordinary `documents` or `slideDecks` row titled *Template · name*, with its
own snapshots and change sets; left out of the project's resource lists. Not a use of the template, and
not a copy anyone keeps: it exists so the original can be edited, and it takes no comments.

**Resource set** (`resourceSets`) — A named selection of the project's things: everything, some kinds,
named resources, or another set, minus exclusions. Made in Project Overview's Contexts panel. A
prompt's scope, a variable's default, and an answer can all name one. Example: *Winter filings* and
*Field evidence* are the seeded sets; the Contexts panel shows how many resources each selects right
now.

**Kind** (document · slides · spreadsheet · finding · research) — One of the five sorts of thing a
project holds, as a set or a default can select them. An existing word; nothing here added one.

**Revision** (`templates.revision`) — A counter on the template that every write advances. A save or an
edit sends the revision it read, and is refused as stale if the template has moved, so two people
cannot silently overwrite each other.

## 3 · Verbs

**Save** (as a template) — Copy the open document, deck, or current slide into a new template of this
project, made portable, and open its working copy in a new tab. The thing you saved from is untouched
and never learns a template was made from it.

**Edit** (open a stage) — Open the template's working copy in its editor, making it if none exists yet.
Double-click in the library, Edit in the inspector, or Edit on a row in the Templates panel.

**Save to template** (commit a stage) — Write the working copy's content back into the template as its
next revision, made portable again, and say what was dropped. The copy stays open.

**Discard** (discard a stage) — Delete the working copy and everything on it. The template keeps its
last saved revision.

**Insert** (into what is open) — Ask what each variable should select, then copy the template's saved
body into the open document or deck after the current row or slide, with fresh ids and missing styles
and layouts brought along. Undo removes it like any edit. Not a link: later changes to the template
never reach what was inserted.

**Use** (instantiate) — Ask what each variable should select, then make a whole new document, deck, or
spreadsheet from the template and open it. The new resource carries no reference to the template; the
template records that it was used.

**Declare** (a variable) — Add a variable to the template being edited, by label, in the Templates
panel; then describe it and set its default. Removing one is refused while the body still names it.

## 4 · Rules that always hold

| Rule | Why |
| --- | --- |
| A template belongs to one project | Its library, its working copy, and everyone who may edit it are that project's; nothing crosses projects. |
| Only the stage writes a template's body | So a copy and its template cannot drift apart, and there is nothing to pull back into the copy. |
| Inserting and Use are copies | A resource made from a template is its own from the first moment and knows nothing of where it came from. |
| A template is portable | It turns a value into a function: pointers into the project go, shapes and expressions stay, and the variables fill the scopes. |
| A working copy takes no comments | Comments do not travel with a template, so none can be started on the copy; the panels say so. |
| Every variable always resolves | An answer, else the default, else everything in the project. |
| Every write is compare-and-swap | A stale save is refused and the panel re-reads; nothing is overwritten by accident. |

## 5 · The words on screen

| You see | It means |
| --- | --- |
| Template · Operational readiness brief | The tab of a working copy: the template's name with the prefix, so the strip says what is open. |
| Editing template | The band in the Templates panel that names the template and its revision while its working copy is open. |
| Save to template · Discard | The two verbs a working copy has instead of Save. |
| Everything in the project | The sentence a default reads as when it selects the whole project; the first switch in the Default modal. |
| Default · Documents, Findings | The first choice in the Insert and Use modals: keep what the template suggests. |
| Dropped a formula's project binding. | A save made the body portable and says what went: here, a formula lost its instance and kept its expression. |
| A template's working copy takes no comments | What the deck's comment panels say in place of the composer on a stage. |
| Used 3 days ago | The template's own record of its last use; no resource is consulted. |

Companions: *Template Stage Flow* for the sequence, *Stages, Sets and Variables* for what changed, and
the reference suite under `docs/reference/template-features/`.
