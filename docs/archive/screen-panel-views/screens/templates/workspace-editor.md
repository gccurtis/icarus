# Templates — the editor

| Workspace | What it is for | Regions |
| --- | --- | --- |
| Entered by double-clicking a card | The template's body, authored on the surface it will become | Bar · Note · Canvas · Body |

**The surface is the resource's, not a template editor's.** Authoring a template
is authoring the thing it makes, so a Document gets a page on a canvas, a deck or
a slide gets a stage, and a Spreadsheet gets a grid.

**The context panel is different, and that is the point.** The surface is the
document editor's; the panels beside it are about a template — what it will ask
for, and who it belongs to — which is why this is a subscreen of Templates rather
than a document opened from the library.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.active.focus` | Model | which template this is |
| `capabilities.library.template` | Capability | the `LibraryTemplate`: name, what it makes, revision |
| `capabilities.library.previewOf` | Capability | the body, with each opening written as its key |
| `capabilities.library.variablesIn` | Capability | the template's variables, and each one's type |
| `capabilities.library.pageSetupFor` | Capability | paper and orientation, for a document template |
| `capabilities.library.outlineIn` | Capability | the headings, and the page count the footer states |
| `capabilities.project.project` | Capability | the running head, which is not on the template model |
| typed lines | Prop | what has been written, keyed by template *and* line |

The project is not among them as a prop. It is read from `/app/[project]` once
and carried on the client model, so a workspace that took it would be offering a
second answer to a question already settled.

**Which template is view state, not a prop.** The library gets here by choosing
one — `showSubscreen("editor", id)` — and `focus` is where that choice lands, so
this centre reads it rather than taking a default that would quietly show the
wrong template the moment anything else changed.

## Layout

| 1fr |
| --- |
| bar |
| note |
| canvas |
| canvas |
| canvas |

The surface carries no padding and no gap of its own: the bar sits flush at the
top and the canvas takes everything under the note, because the canvas is the
thing that has to look like the application the template will be used in.

## Bar

Which template, whether it is saved, and the way back.

**Example** — ← **All templates** · "Regulatory filing shell" · `Document`
`Saved` · revision 6

### Structure

- `ScreenBar` — title, back, and a `meta` snippet
  - `PanelChip` — what it makes
  - `PanelChip` — `Saved`, or `Saving…` `tone="attention"`
  - the revision, as a caption, on a template that already exists

### Behavior

**The bar is the whole of what this state costs.** Without it the screen is
indistinguishable from editing the real document, and there is no way back to the
library. Back calls `showSubscreen("library")`.

**A template has no draft state**: every change to one is a change to the
template, which is the difference between authoring a template and filling one
in. So the honest indicator is not a Save button but a report that the writing
has already happened — and this one reports about a write that does not happen at
all, because the doors are reads.

## Note

What is real on this surface and what is not.

**Example** — "The document, deck and spreadsheet editors are not wired in yet,
so this is the shape of the one this template makes, filled from the body door.
Lines can be typed; nothing else on the surface acts, and nothing is written
back."

### Structure

- `ScreenNote` `tone="gap"` — under the bar, above the canvas

### Behavior

It is above the canvas rather than on it, because it is a statement about the
surface rather than about the template — and putting it inside the page would
make it read as content the template carries.

## Canvas

The surround, and the surface floating on it.

**Nests** — body

### Structure

- `ScreenCanvas` — the surround, labelled with what it holds
  - `ScreenPage` — for a Document: paper, orientation, a `header` and a `footer`
    snippet
  - `ScreenGrid` — for a Spreadsheet: four columns, ten rows, with a cursor
  - `ScreenSlide` — for a deck or a slide: 16:9, with positioned objects

### Props

`ScreenPage` takes the page setup's paper and orientation as settings rather than
as prose, and a caption naming the kind. The canvas holds nothing itself: what it
does is give the surface an edge, so the template reads as an object being made
rather than as the whole tab.

**Furniture is carried into every copy and none of it is on the model.** The
running head is the project's name and the page setup, and the footer is the
template's name and the outline's page count — drawn from doors rather than from
invented sample text, and taken from the outline so the footer cannot disagree
with the body above it.

### Behavior

A slide template's objects render as plain elements rather than as selectable
ones. Selecting an object is the deck editor's job and it does not exist yet, so
nothing here offers a control that would do nothing.

## Body

Where the template is actually written. Ordinary content, and the openings left
in it — which is the whole of what distinguishes this surface from an editor.

Three kinds of opening, each rendering differently because each behaves
differently:

| Kind | How it reads | What it becomes |
| --- | --- | --- |
| Text variable | An inline atom in running prose — `filingDocket`, `filingParty` | The supplied string, set as ordinary text |
| Table variable | A placed block, dashed, labelled with its key | The supplied table, set as ordinary rows |
| Generated variable | A prompt block, labelled *Generated · execSummary* | A prompt block in the copy, which runs on first open |

**Example** — a heading, a paragraph reading "Docket *filingDocket*, filed by
*filingParty* under the statutory basis set out below.", a dashed block labelled
*table variable · outageTable*, and a generated block reading "An executive
summary of the filing, which runs on first open."

### Structure

- one line per body line, each editable in place
- a dashed block per placed table variable
- a tinted block per generated variable, after the prose

### Props

An atom is bordered and tinted so it reads as one thing that will be replaced,
rather than as a word that happens to be styled.

Typed lines are keyed by template *and* line, because the body door hands every
template the same six line ids — keyed by line alone, a sentence typed into one
template shows up in the next template opened.

### Behavior

**Escape abandons and Enter commits**, and neither reaches the surface
underneath. A template body is the only editable thing on this screen, so the
keys have to stop here rather than being caught by a page that would treat Escape
as "leave the editor".

**The body is the gate on this screen.** Nothing in a body records which variable
it stands for, so the three kinds of opening are drawn from the preview door and
the variable list beside it — which can say how each reads and cannot say where
any of them actually sits. Generated variables are placed last for exactly that
reason: placement is the thing the model cannot state.

Everything else on this surface behaves as it does in the ordinary editor, and is
inspected with [the ordinary lenses](../../inspector/library/body-entity.md).
