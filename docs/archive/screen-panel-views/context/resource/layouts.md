# Layouts

| View | What it is for | Sections |
| --- | --- | --- |
| Layouts | Which layout this slide uses, and what else it could use | Current · Deck layouts |

Applying a layout, from the slide's side. Editing one is the other subscreen.

## Layout

| 300px |
| --- |
| actions |
| current |
| current |
| deck layouts |
| deck layouts |
| deck layouts |

## Current

The layout this slide is on, with what it contributes.

**Shows** — *Title and two panes* — 2 placeholders · 2 locked

**Needs** — the slide's layout reference, and that layout's placeholder and locked
counts.

## Deck layouts

Everything else available, as cards, because a layout is a shape and a shape
should be seen.

**Shows** — *Title slide*, *Section break*, *Full-bleed chart*, *Blank*, each with
its placeholder and locked counts.

**Needs** — the deck's layout list with a preview render per layout.

## Panel furniture

The action row: **Apply**, **Reset to layout**, **Edit layout**.

**Reset to layout** is disabled.

**Open** — reset is only well-defined when a slide element's `fromPlaceholder`
resolves to exactly one role. `SlidePlaceholder` has no stable key, so two
placeholders with the same role cannot be told apart and reset stays gated.

**Edit layout** enters the layout subscreen. Entering it commits or cancels any
nested block edit and starts a distinct undo group.
