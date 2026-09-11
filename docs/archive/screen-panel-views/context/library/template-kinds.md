# Kinds

| View | What it is for | Sections |
| --- | --- | --- |
| Kinds | The four things a template can make, each with a way to start one | Document · Presentation · Slide · Spreadsheet |

A creation view organised by target, because target is the one decision that
cannot be changed afterwards.

## Layout

| 300px |
| --- |
| document |
| presentation |
| slide |
| spreadsheet |

## Document

**Shows** — "A paginated body with variables left open.", with **New**

**Needs** — template creation with a document target.

## Presentation

**Shows** — "A whole presentation: layouts, theme, sections.", with **New**

**Needs** — template creation with a presentation target.

## Slide

**Shows** — "One slide, reusable on its own. Inserted into any presentation.", with **New**

A single slide is a template kind of its own, not a presentation with one slide in it. It
is inserted into an existing presentation rather than opened.

**Needs** — template creation with a slide target.

**Open** — slide-level templates need a target discriminant the model does not
have. Until it exists, a slide template cannot be distinguished from a presentation one.

## Spreadsheet

**Shows** — "Sheets of cells holding text and formulas.", with **New**

**Needs** — template creation with a spreadsheet target.

**Open** — the wording still says "sheets", from before a spreadsheet became one
grid.
