# Overview — the template library

| View | What it is for | Sections |
| --- | --- | --- |
| Overview | Start a template or see the shape of the whole library | New template · Library |

The orientation panel for the Templates library. Recent use remains on the
centre shelf and selection details remain in the inspector, so neither is
repeated here. Its sections are fixed, compact regions rather than disclosures.

## Data

`templates/procedures/library.svelte.ts` is the shared reactive mock for the
centre, context and inspector. It supplies explicit sample data because stored
templates do not yet carry ownership scope or usage history. Context creation
adds a session-local row to that same source; it does not modify representation
or claim persistence.

## New template

Three full-width `PanelButton`s create an empty Project template: Document,
Slide deck and Spreadsheet. The new row appears immediately in the table and is
selected in the inspector. It has no usage event, so it does not enter the
recent shelf.

## Library

One compact record reports the total number of templates. Under it, Availability
breaks that total into Project, Shared and Personal; Kind breaks it into
Documents, Slide decks and Spreadsheets. Labels and values share the caption
type step, with weight and colour—not size—carrying their distinction. There are
no oversized stat tiles.
