# A named style

| Selecting | What it is | Sections |
| --- | --- | --- |
| A named style in the Theme view | Deck typography, edited once for everywhere it is used | Identity · Typography · Usage |

The same principle as the document editor's styles, with one addition: a deck
style has a *style key*, because a layout placeholder names a style by key rather
than by name.

## Layout

| 300px |
| --- |
| identity |
| typography |
| usage |

## Identity

**Shows** — `Name · Slide title`, `Style key · title`

**Needs** — the style's display name and its key.

**Open** — name and key can drift apart. Whether the key is authored or derived
from the name at creation needs settling.

## Typography

**Shows** — `Family · IBM Plex Sans`, `Size · 24 pt`, `Weight · 600`

**Needs** — the typography fields on the deck `StyleSet`.

**Open** — no line height. The document's equivalent has one; a deck's does not,
and a title without one will set inconsistently.

## Usage

Starts collapsed.

**Shows** — "Applied to 8 elements."

**Needs** — a count of elements referencing this style.
