# Templates — the library

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The centre this tab opens on | Every template available here, as shapes, in folders | Header · Filters · Templates · Note |

**A place rather than a list.** The one screen that keeps a library-and-editor
pair, and this half is why: the library has folders and holds templates that were
never made here, so it is somewhere you navigate rather than a table you read
down.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.library.templates` | Capability | a `LibraryTemplate` per template: name, what it makes, scope, variable count, when it changed |
| `capabilities.library.templateKinds` | Capability | the four things a template can make, for the dropdown |
| `view.selection` | Model | which card is inspected |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a workspace that took it would be offering a second
answer to a question already settled.

## Layout

| 1fr |
| --- |
| header |
| filters |
| templates |
| templates |
| note |

One track: a card grid already wraps to the width it is given, so there is
nothing for a second column to hold. *Templates* is written twice because that is
how the grid takes its height off the bands around it.

## Header

What a template is, and nothing you can press.

**Example** — "Templates" over "A real body with variables left open. Using one
makes an independent copy — later edits to the template never reach it."

### Structure

- `ScreenHeader` — title and `about`

### Behavior

**There is no New template button here.** Making one is an act of the rail rather
than of the title: it starts with choosing what the template makes, which is a
question, and it lives in
[the Overview context view](../../context/overview/templates-library.md).

## Filters

A search, a dropdown, a sort and a direction. There is no scope filter.

**Example** — "Search every template" · ← **All templates** · `All kinds ▾` ·
↑ **Ascending** · `Updated ▾` · "12 of 41"

### Structure

- `ScreenFilters` — the search, the sort and the matched-of-total count
  - `Button` — **All templates**, out of an open folder; present only inside one
    and not while searching
  - `select` — what it makes: All kinds, then the four
  - `Button` — the direction, with an arrow and the word

### Props

The sorts are Updated, Name, Makes and Variables.

### Behavior

**The kind filter is a dropdown, not a run of chips.** Five options is a menu's
worth; five chips beside a search, a sort and a direction would make the filter
row wider than the card grid it filters.

**Scope is not a filter at all** — it is the folder, and then a colour on the
card.

**Direction shares the order's frame: which way a sort runs is half of that one
decision.** Two separately bordered controls beside each other read as two
questions rather than as one asked twice. Ascending is what anybody wants of both
*Updated* and *Name* — the smallest age is the newest — so the arrow starts
pointed the way either order is usually read, and the button says the word as
well as drawing the arrow.

*Updated* is prose — "2 weeks ago", "6 months ago" — so ordering by it means
reading it. The door's own order is not recency, so trusting the array as it
arrives puts a five-week-old template above a three-week-old one and calls the
result *Updated*. Anything unreadable sorts to the far end, never to the top
where it would look freshest.

## Templates

Folders, then cards. Every card is the same height.

**Example** — three folders, `Project` "6 templates" · `Shared` "1 template" ·
`Personal` "1 template"; opened, a card: a preview in a fixed band, *Regulatory
filing shell*, and under it `Project` · Document

**Nests** — the folder grid and the card grid share the slot; searching replaces
both with matches

### Structure

- `ScreenGroup` — labelled with the open folder's name, *Folders*, or *Matching
  templates*, and counted
  - `ScreenCards` `min="14rem"` — one `ScreenCard` per scope at the top level
  - `ScreenCards` `min="14rem"` — one `ScreenCard` per template inside a folder
    - `ScreenThumb` — the preview, at the target kind's aspect ratio
  - `ScreenEmpty` — an empty folder, or nothing matching

### Props

**Whose a template is, is a folder and not a filter.** Project, Personal and
Shared decide who may edit one, which is the first thing that changes what you
can do about it — and a chip row would put that on the same footing as "makes a
deck".

**Scope is then said again on the card, in colour.** A card lifted out of its
folder by a search has lost the one thing the folder was telling it, so the
subtext leads with the scope and the type comes second: `Project · Document`. The
three hues mean nothing else — `accent-1` and `accent-2` exist for exactly this,
categorical work claimed by no meaning role, and the project's own templates take
`primary` because the project is the ground everything else here is measured
against. No meaning role is borrowed: whose a template is, is not a success or a
warning.

**Every card is the same height.** A grid you scan for a shape is unreadable when
the shapes set the heights — the eye reads the ragged bottom edge before it reads
any of them — so the thumb gets a fixed band and keeps its aspect ratio inside
it: 4:3 for a document, 16:9 for a deck or a slide, 1:1 for a spreadsheet.

The preview counts a body's openings and cannot place them. Nothing in a body
records which variable it stands for, which is what the note under the grid says
out loud.

### Behavior

**Searching flattens the folders**, exactly as the Agents library does: a search
is a question about all of them, and making someone open three folders to answer
it is the folder winning over the question.

**Single click selects and inspects; double click opens the editor.** Two acts —
conflating them would mean you could not look at a template without leaving the
grid you were comparing it against. Selecting puts it in
[its lens](../../inspector/library/template.md); double-clicking calls
`showSubscreen("editor", templateId)`.

A folder's count is taken against what the dropdown leaves, so a folder never
promises more than it holds.

## Note

One line under the grid.

**Example** — "Previews are rendered from the real body. The model has no
thumbnail, tag, category, favourite or usage count, so the library does not
pretend those exist." · "12 of 41"

### Structure

- `ScreenNote` — the sentence, with the count as `meta`

### Behavior

**One figure, said in three places, and it counts what is on screen.** Inside a
folder, a filter row reporting every match in the library over a grid showing one
folder's worth would have the row, the band and this note each claiming a
different number for the same view.
