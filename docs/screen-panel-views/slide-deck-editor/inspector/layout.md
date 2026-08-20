# A layout

| Selecting | What it is | Sections |
| --- | --- | --- |
| A layout in the Layouts view | The layout: what it is made of, what it inherits, and what editing it will do | This layout · Background · Careful · Actions |

## Layout

| 300px |
| --- |
| this layout |
| this layout |
| background |
| careful |
| actions |

## This layout

Name, editable, and what it consists of. *Used by* is the number that matters.

**Shows** — `Name · Title and two panes`, `Placeholders · 3`, `Locked content · 2`,
`Used by · 4 slides`

**Needs** — the layout record and a count of slides referencing it.

## Background

**Shows** — `Source · Inherited from theme`

**Needs** — an optional background override, distinguishable from inheritance.

## Careful

The warning, as a section rather than a dialog: editing a layout changes every
slide using it. Slides keep their own copies of placeholder *content* — only the
frame, the locked content and the background come from here.

Worth its own section because the distinction between "the layout changed" and
"my slide's text changed" is the thing people get wrong about layouts.

**Needs** — nothing.

## Actions

**Done** returns to the slide subscreen. **Duplicate** makes a copy.

**Open** — no delete. See [the Layouts view](../context/layout-layouts.md) for why.
