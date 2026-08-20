# Slide deck editor — panels

One slide on a canvas, the deck in the panel, every property of what you selected
in the inspector. There is no toolbar: arrange, align, distribute and format are
inspector work.

Two subscreens: **editing a slide** and **editing a layout**. They are the same
tab in two states, and the rail changes completely between them.

## Context panel — editing a slide

| View | What it is for | Sections |
| --- | --- | --- |
| [Slides](context/slides.md) | The deck itself, and everything you do *to* a slide | Sections of the deck |
| [Overview](context/overview.md) | The deck as a whole | This deck · Editing now · Saved · From template |
| [Layers](context/layers.md) | What is on this slide, in stacking order | Slide objects · Layout objects |
| [Find](context/find.md) | Search across the whole deck | Results |
| [Layouts](context/layouts.md) | Which layout this slide uses, and switching it | Current · Deck layouts |
| [Insert](context/insert.md) | Putting something new on the slide | Basics · Data and AI |
| [Theme](context/theme.md) | Deck-wide colour, type and named styles | Theme · Named styles |
| [Notes](context/notes.md) | Speaker notes, for this slide and across the deck | Slide *n* · Deck |
| [Variables](../_shared/context/variables.md) | The project's named values | *shared* |
| [Comments](context/comments.md) | Conversation on the deck | Scope chips · Open · Resolved |
| [Context](context/context.md) | What prompt blocks in this deck can look up | Saved Contexts |

Slides is first, not Overview. On every other screen an overview orients you; on
a deck the list of slides *is* the orientation.

## Context panel — editing a layout

| View | What it is for | Sections |
| --- | --- | --- |
| [Layouts](context/layout-layouts.md) | Every layout in the deck, and which one you are editing | In this deck |
| [Objects](context/layout-objects.md) | What the layout owns, split by what a slide may touch | Locked content · Placeholders |
| [Theme](context/layout-theme.md) | What this layout takes from the deck theme, and what it overrides | Background |
| [Variables](../_shared/context/variables.md) | The project's named values | *shared* |

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| An element on the slide | One object: its content, frame, stacking and format | [element.md](inspector/element.md) |
| Several elements | The shared properties, and align and distribute | [multi-selection.md](inspector/multi-selection.md) |
| Text inside an element | The block inside the box | [text-block.md](inspector/text-block.md) |
| A layout, from Layouts | The layout, and the warning that it is shared | [layout.md](inspector/layout.md) |
| A locked element | Layout-owned content a slide cannot touch | [locked-element.md](inspector/locked-element.md) |
| A placeholder | A frame a slide fills in | [placeholder.md](inspector/placeholder.md) |
| A slide, from the Slides panel | The slide: its layout, its section, its notes | [slide.md](inspector/slide.md) |
| Nothing | The deck itself | [deck.md](inspector/deck.md) |
| The theme | Deck-wide colour and type | [theme.md](inspector/theme.md) |
| A note | Speaker notes for one slide | [speaker-notes.md](inspector/speaker-notes.md) |
| A named style | Deck typography, edited once | [named-style.md](inspector/named-style.md) |
| A comment | One thread on a slide | [comment.md](inspector/comment.md) |
| An avatar, a "who" link, a variable | *shared* | [`_shared/inspector`](../_shared/inspector/) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| Every state | The editor — a Fabric canvas, and what Icarus adds to it | [workspace.md](workspace.md) |

Editing a slide, editing a layout and choosing a new slide are all states of one
editor. The framework does not change between them, only what it shows.

## The rules this screen keeps

**New, duplicate, delete and hide live at the top of the Slides panel**, where the
slide they act on already is — not in a toolbar across the canvas.

**Element and block are different things.** The element is the spatial container;
the block is ordinary content inside it. Frame, rotation and overflow never leak
into block content.

**Editing a layout changes every slide using it.** The layout subscreen says so
where you can see it, not in a dialog you dismissed.
