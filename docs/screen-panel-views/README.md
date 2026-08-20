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
<screen>/
  README.md          the screen's three tables — every view, selection and workspace
  workspace*.md      the centre of the screen; one file, or one per state
  context/           one file per context-panel view
  inspector/         one file per kind of thing you can select
_shared/             lenses and views that belong to no single screen
```

The two panels are directories because they hold many files. A workspace is one
file, or two, so it sits directly under the screen: `workspace.md` where there is
one, `workspace-library.md` and `workspace-profile.md` where there are two.

Eleven screens, named as in [`docs/screen-specs`](../screen-specs/).

Anything reachable from every screen lives in [`_shared/`](_shared/) rather than
being repeated eleven times: the actor lenses, the Copilot's lenses, and the
project Variables view. A screen's README lists them without restating them.

## The shape of a file

Every file opens with a one-row table:

| Selecting … | What it is | Sections |
| --- | --- | --- |
| what you clicked, or what the rail entry is | what it represents, and what you should be able to do and see | the sections it contains, in order |

Then a short statement of what the panel is for, then the layout grid, then one
`##` section per region. Each section says what it shows, gives an example of the
*kind* of data — not a mock of the real thing — and names what it needs to have
access to.

### The layout grid

Every file carries a `## Layout` table that is the panel drawn as a grid. It is
the visual half of the specification, and it is read like this:

- **The header row is the column tracks** — `grid-template-columns`, written the
  way it will be written in CSS. `| 300px |` is one column. `| 2fr | 1fr |` is
  two, the first twice the width of the second.
- **Every cell carries a label.** The same label in adjacent cells is one region
  spanning them — across for width, down for height. Rows are proportional
  bands, not fixed heights, so a region occupying three rows is simply taller
  than one occupying one.
- **Each label has a `##` section below** describing what goes in it. Labels are
  the section titles in lower case.

Three labels are the panel's frame rather than its content, and are described
together under **Panel furniture**: `search`, `actions` and `footer`. The pane
title and the inspector's breadcrumb belong to the shell, appear on every panel,
and are not drawn in the grid.

A region's internal arrangement — an avatar beside a name, a key-value pair, a
row of buttons — belongs to that region's prose. The grid stops at regions.

Anything a table cannot say goes in one line directly under it: two regions
sharing a slot and switched by a control, a region that only appears in some
states, a region pinned while its neighbour scrolls.

Three inline labels recur:

- **Shows** — an example of the data, concrete enough to judge.
- **Needs** — what the section reads. Model entities where they exist, plainly
  named capabilities where they do not.
- **Open** — something unresolved. A model gap, a question for review, or a
  decision deliberately deferred.

A section marked *starts collapsed* is closed on arrival. That is a disclosure
decision and it belongs to the deck, but it is recorded here because it is part
of what a panel promises.

## Workspaces

A workspace file describes the centre of a screen. A second file is warranted only
when the centre becomes a genuinely different thing — a template library and a
template being authored, a Context resolved and every Context listed. A state
*inside* one surface is not a second workspace: choosing a new slide happens in
the slide editor, and belongs to it.

**Three screens are the exception, and only three.** The document editor, the
slide deck editor and the spreadsheet editor each get one workspace file whose
grid is a single region — `editor` — because the centre is a framework surface
and drawing it as regions would describe the framework's job rather than ours.
Those files say something different instead: which framework, what we take from
it, what we deliberately do not, what Icarus builds on top, and what is
configurable.

Every other centre is drawn in full, including the screens that also edit
something — Context, Analysis, Personas, Automations and template authoring all
have complete grids, because none of them is a framework surface.

## What is not here

**Density, order and disclosure.** The grid says what regions exist and how they
are arranged. How tightly each is packed, what is collapsed on arrival, and how
it reads at 1280px is the deck's subject. Where the two disagree, the deck is a
drawing of a proposal and this is the proposal.

## Related

[screen specifications](../screen-specs/) · [screen deck](../screen-deck/) ·
[client model](../client-model/) · [data models](../data-models/)
