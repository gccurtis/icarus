# A new document

| Selecting | What it is | Sections |
| --- | --- | --- |
| The Document pill, or the Document row in Create | What a document will be, before it exists | Identity · Page · Create |

The launcher's inspector for a thing that does not exist yet. Everything here is
draft state, held by the tab, and none of it is written until **Create**.

## Layout

| 300px |
| --- |
| identity |
| page |
| page |
| create |

## Identity

**Shows** — `Title · Untitled document`, editable in place.

**Needs** — nothing. Draft state on the launcher.

## Page

Paper, orientation and margins, asked now because changing them later reflows a
document that already has content in it.

**Shows** — `Paper · Letter | A4`, `Orientation · Portrait | Landscape`,
`Margins · 1 in all round`

**Needs** — the same `PageSetup` shape the document editor uses, so the choice
made here is the choice the editor shows.

**Open** — there is no modeled project or user default to pre-select, so the
default is hard-coded. Whether that should be a project setting is unsettled.

## Create

One button. This tab becomes the document — it does not open a second one.

**Needs** — a launcher target and an atomic resolve step that mints the resource
and rebinds the tab to it.
