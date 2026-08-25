# Screen panel views

What belongs in every panel of every screen, written out so it can be argued with
as text and seen as a grid. One file per context view, one per kind of thing you
can select, one per state the centre of a screen can be in.

This exists because the two questions are different. *How is it arranged, and
what is disclosed when* is a visual question, and [the screen
deck](../screen-deck/) is where that gets answered. *What should be on the page
at all* is not visual, and reading it off a drawing is slow and lossy. These
files answer the second question only.

They are working documents. Edit them directly — that is the point. When a file
settles, it becomes the thing that gets built.

## The shape of it

```text
screens/<screen>/
  overview.md        what this screen is, and every view and lens it reaches
  workspace*.md      the centre of the screen; one file, or one per state
screens/_shared/     surfaces that belong to no screen — the status bar
context/<subject>/   one file per context-panel view
inspector/<subject>/ one file per kind of thing you can select
modals/              work that wants the whole screen rather than a flank
_reference/          the two files every file above is written against
```

**A screen owns only what nothing else could.** Its index and its centre. Every
panel lives in one of the two global trees, because a panel is a function of
models and capability calls rather than of the screen that happens to be showing
it — the Variables view is the same view on a document, a deck and Project
Overview, and writing it three times is how three copies drift.

A screen's `overview.md` is therefore a list of what it reaches, not a container
for it. Nine screens: `agents`, `analysis`, `document-editor`, `new-tab`,
`project-overview`, `research`, `slide-deck-editor`, `spreadsheet-editor`,
`templates` — three of them permanent tabs, and the other six minted by opening
something.

**A surface that belongs to no screen goes in
[`screens/_shared/`](screens/_shared/).** The status bar is one: it is a plane
with regions rather than a stack in a 300px column, so it is written against the
workspace reference, and putting it under a screen would be a claim that one tab
owns it.

### The subjects

Both trees are cut the same way, by what a panel is *about* rather than by where
it appears:

| Subject | Holds |
| --- | --- |
| `overview/` | the orientation view each screen opens on — the one group that is one file per screen |
| `project/` | the project as a whole: its people, activity, health, resources, variables |
| `resource/` | a document, deck or spreadsheet being edited, and everything inside one |
| `library/` | collections and launchers: every-X lists, recents, templates, what you can make |
| `scope/` | Contexts — what a question is allowed to look at |
| `analysis/` | fields, charts, and what an analysis is made of |
| `research/` | inquiry, findings, sources, and the trace behind them |
| `agents/` | personas, tasks and automations: what they are, what they may do, what they did |
| `collaboration/` | people and comments *(inspector only)* |
| `copilot/` | the surface that belongs to no tab *(inspector only)* |

A file whose name repeats across subjects is qualified by its surface —
`find-document`, `find-deck`, `find-sheet` — until someone reads the three and
decides whether they are one view. Where they are, they become one file:
[the comment lens](inspector/collaboration/comment.md) is one such, answering for
a thread on a document, a deck and a spreadsheet alike.

## The shape of a file

[`_reference/`](_reference/) holds the two reference files. Copy one and write
over the `{{…}}` placeholders; `rg '{{'` finds every part still unwritten.

| Reference | For |
| --- | --- |
| [panel-reference.md](_reference/panel-reference.md) | A context view, or an inspector lens |
| [workspace-reference.md](_reference/workspace-reference.md) | The centre of a screen |

Every file opens with a one-row table naming what it is and the sections it
holds, then a short statement of what it is for, then its data, then its layout,
then one `##` section per region. Labels in the layout are the section titles in
lower case.

### Data before layout

A panel is a function of its sources, and the sources are models and
capabilities. The `## Data` table names each one, says which kind it is, and says
what it answers. **A prop is the exception**, for what no source can supply —
a callback upward, a value the parent alone knows — because a panel taking its
content as props would need a parent that already knew the answer.

The project is never one of them. It is read from `/app/[project]` once, at
`initClientModel`, and carried on the client model for the life of the instance;
a panel asking for it as a prop would be a second answer to a settled question,
and a panel reaching back into `page` would be a third.

The transform between a source and a component's props is a procedure, and is not
described here. Naming both ends is enough.

### The layout table

A panel is one column and stacks, so its layout is flat: one row per label, top
to bottom, and the components in it. A workspace has the generous plane and can
place regions beside one another, so its layout is a grid — the header row is
`grid-template-columns`, written the way it will be written in CSS, and a label
repeated in adjacent cells is one region spanning them, across for width and down
for height. Rows are proportional bands, not fixed heights.

Either way the table stops at regions. A region's internal arrangement — an
avatar beside a name, a key-value pair, a row of buttons — belongs to that
region's own section.

**Draw what varies, for this kind of panel.** The pane title is on every panel
and is never drawn. A breadcrumb is on every inspector lens, so it is furniture
there — and it is on almost no context view, so a context view that has one is
drawing the thing that makes it unusual. The actions row is always drawn: what a
panel offers is its own, it takes a band of the stack, and it is where a reader
looks first because `Panel` has no footer.

Rendering through one of the frame's slots does not exempt a region. The question
is whether a reader of this file would be surprised by it.

Anything a table cannot say goes in one line directly under it: two regions
sharing a slot and switched by a control, a region that only appears in some
states, a region pinned while its neighbour scrolls.

### Naming a component

Name the real one: `PanelFields` from
[`unique-components/panel`](../../app/src/lib/unique-components/panel/index.ts),
`ScreenTable` from
[`unique-components/screen`](../../app/src/lib/unique-components/screen/index.ts),
or a [simple component](../../app/src/lib/simple-components/) where the control
carries behaviour worth keeping. A panel names the panel family, a workspace names
the screen family.

A component that does not exist yet is written plainly and marked `(new)` —
`PanelDivider (new)`. That reads as a specification and greps as a build queue.

### What a section says

A region is a `##`. Two facts sit directly under it, because they are one line
each and a heading over one line is a heading in the way:

- **Example** — sample content, concrete enough to judge the density by. It is
  illustrative, never a mock of the real thing.
- **Nests** — the other regions this one contains, by label, comma separated.
  The layout table is the visual stack and says nothing about containment; a
  region whose component wraps its neighbours says so here. Omit it when a region
  contains none.

The rest are `###`, because each runs to a list or a paragraph and a bold word
at the head of a block is not a heading a reader can scan back to:

- **Structure** — the components in the region, as a nested list, one level per
  indent. A level earns its line by carrying a decision: a wrapper that could
  have been something else, a repeat, a component present only in some states. A
  container's only possible child is not a level — `PanelFields` holds
  `PanelField`s and saying so twice tells a reader nothing. Put *why* on each
  line, because the arrangement is the part a layout table cannot hold.
- **Props** — what each component is given, named as the component names it.
- **Behavior** — what a click, hover, drag or keypress does, and what results.

A file records decisions, not doubts. An open question is asked and answered
before the file is written; a decision that was hard is written as prose in the
region it belongs to, with the reasoning that settled it. Nothing is parked in
the document for someone to find later.

A section marked *starts collapsed* is closed on arrival. That is a disclosure
decision and it belongs to the deck, but it is recorded here because it is part
of what a panel promises.

## Workspaces

A workspace file describes the centre of a screen. A second file is warranted only
when the centre becomes a genuinely different thing — a template library and a
template being authored, a persona and the task it is running. A state *inside*
one surface is not a second workspace: choosing a new slide happens in the slide
editor and belongs to it, and four research threads open at once are four tabs on
one workspace rather than four centres.

**A list of things is not a centre.** Choosing which thread or which analysis to
look at is navigation, and navigation belongs in the context panel, so Research
and Analysis each reach their library from the rail. Templates holds a pair only
because that library has folders and holds templates from outside the project —
it is a place rather than a list.

**Three screens are the exception, and only three.** The document editor, the
slide deck editor and the spreadsheet editor each get one workspace file whose
grid is a single region — `editor` — because the centre is a framework surface
and drawing it as regions would describe the framework's job rather than ours.
Those files say something different instead: which framework, what we take from
it, what we deliberately do not, what Icarus builds on top, and what is
configurable.

Every other centre is drawn in full, including the ones that also edit something
— Analysis, all four Agents centres and template authoring have complete grids,
because none of them is a framework surface.

## What is not here

**Density, order and disclosure.** The grid says what regions exist and how they
are arranged. How tightly each is packed, what is collapsed on arrival, and how
it reads at 1280px is the deck's subject. Where the two disagree, the deck is a
drawing of a proposal and this is the proposal.

## Related

[screen specifications](../screen-specs/) · [screen deck](../screen-deck/) ·
[client model](../client-model/) · [data models](../data-models/)
