# New Tab — the workspace

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The only state this screen has | One question: which editor do you need? | Search · Editors · Recent · Templates |

A funnel, top to bottom: find the thing you meant, or make one of three, or start
from something that already exists.

## Layout

| 1fr |
| --- |
| search |
| editors |
| recent |
| recent |
| templates |
| templates |

## Search

One field, centred and capped at about 640px, over everything in the project. It
is first because "open the thing I was working on" is more common than "make a
new one".

**Shows** — a wide field reading "Search Northwind Grid Resilience"

**Needs** — a project-wide search across every kind.

**Open** — whether results replace the regions below or drop under the field. The
first is a mode change in a tab whose whole job is one question.

## Editors

Three pills, centred: Document, Slide deck, Spreadsheet. Nothing else.

Research, Analysis, Context, Templates, Personas and Automations are permanent
tabs. Offering to create one would imply they can be absent.

**Needs** — the three editor kinds. Selecting one changes the inspector; nothing
is made until the inspector's Create.

## Recent

A carousel of what you had open, scanned sideways. A shelf rather than a grid,
because a grid of twelve cards pushes the search field off the top of the screen.

**Shows** — cards with a thumbnail, a kind icon, a name and a relative time:
*Q3 Resilience Memo* — Document · 4m

**Needs** — recently-opened from local tab history and recently-updated from
`updatedAt`; the two are different lists merged into one shelf.

## Templates

The same shelf, for starting from something. Variable counts sit on the card,
because that is what decides whether it can be used.

**Shows** — *Regulatory filing shell* — Document · 4 variables

**Needs** — `Template` records with target kind, scope and variable count, and a
preview rendered from the real body.

**Open** — every template with variables is unusable until a body entity can carry
a variable key, so the shelf currently offers things that cannot be taken.
